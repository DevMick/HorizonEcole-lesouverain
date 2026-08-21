# Prérequis serveur

Ce document liste ce qui doit être installé **sur la machine** et qui ne vit pas
dans le dépôt. Ces éléments survivent aux déploiements de code, mais seraient
perdus si le serveur était reconstruit — chacun a provoqué une panne réelle en
production, avec le symptôme indiqué.

Serveur de référence : Ubuntu 24.04 « noble », Odoo 19, PostgreSQL local.

---

## 1. wkhtmltopdf — version *patched Qt* obligatoire

**Symptôme si absent :** les PDF se génèrent, mais **sans en-tête, sans pied de
page et sans filigrane**. Aucune erreur n'apparaît dans les logs, ce qui rend le
diagnostic trompeur.

**Cause :** Odoo écrit l'en-tête et le pied de page dans des fichiers temporaires
puis les passe à wkhtmltopdf via `--header-html`, **en même temps que**
`--disable-local-file-access`. Seule la version compilée avec le Qt patché sait
lire ces fichiers dans ce mode. La version des dépôts Ubuntu
(`wkhtmltopdf 0.12.6-2build2`) ne le sait pas et les ignore silencieusement.

La distinction se lit dans la version : la mention `(with patched qt)` doit
apparaître.

```bash
apt-get install -y xfonts-75dpi
cd /tmp
wget -O wkhtmltox.deb https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3.jammy_amd64.deb
apt-get install -y ./wkhtmltox.deb
rm -f wkhtmltox.deb
systemctl restart odoo
```

Le paquet `jammy` (22.04) fonctionne sur 24.04 : la dépendance habituellement
bloquante, `libjpeg-turbo8`, y est disponible.

Il s'installe dans `/usr/local/bin`, qui précède `/usr/bin` dans le `PATH` — il
prend donc le pas sur une éventuelle version distribution sans avoir à la
désinstaller.

**Contrôle :**

```bash
wkhtmltopdf --version        # doit afficher : 0.12.6.1 (with patched qt)
```

Et côté Odoo, `état` doit valoir `ok` et `patched` valoir `True` :

```bash
cd /opt/odoo/odoo-server && /opt/odoo/venv/bin/python odoo-bin shell \
  -c /etc/odoo/odoo.conf --no-http --log-level=error <<'PY'
from odoo.addons.base.models.ir_actions_report import _wkhtml
w = _wkhtml()
print('binaire :', w.bin, '| patched :', w.is_patched_qt, '| etat :', w.state)
PY
```

---

## 2. geoip2 — sinon toute session authentifiée est rejetée

**Symptôme si absent :** la connexion réussit, puis **toutes** les routes
renvoient `403 Forbidden — Access Denied`, y compris `/login` elle-même.

**Cause :** sans le paquet, `odoo/http.py` n'exécute pas le bloc `if geoip2:` qui
définit `GEOIP_EMPTY_COUNTRY`. À chaque requête portant une session avec un
`uid`, `security.check_session` → `res.device.log._update_device` →
`GeoIP.get('country_name')` lève un `NameError`, que `ir_http` convertit en
`AccessDenied`. Le vrai traceback n'est journalisé qu'en `INFO`, invisible avec
`log_level = warn`.

```bash
/opt/odoo/venv/bin/pip install geoip2
systemctl restart odoo
```

Aucune base MaxMind n'est nécessaire : sans elle la géolocalisation renvoie
simplement `None`, ce qui est correct.

Pour faire apparaître le traceback derrière un futur `Access Denied`, ajouter
temporairement dans `/etc/odoo/odoo.conf` :

```
log_handler = odoo.addons.base.models.ir_http:DEBUG
```

---

## 3. Au moins 4 workers Odoo — sinon l'impression PDF s'interbloque

**Symptôme si insuffisant :** la page `/report/pdf/...` tourne indéfiniment, et
tout Odoo se fige derrière (« Ne quittez pas encore, ça charge toujours… »).
Aucune erreur : les processus attendent, simplement.

**Cause :** pour rendre l'en-tête et le pied de page, wkhtmltopdf **rappelle
Odoo en HTTP** afin de récupérer les feuilles de style. Une impression consomme
donc au minimum deux workers — un qui traite la requête et attend la fin de
wkhtmltopdf, un autre qui sert les assets à ce dernier. Avec `workers = 2`, deux
impressions simultanées bloquent les deux workers, chacun attendant un wkhtmltopdf
qui attend lui-même un worker libre. Personne n'avance.

À noter : le problème n'apparaît **qu'une fois wkhtmltopdf correctement installé**
(section 1). Avec la version non patchée, l'en-tête est ignoré, wkhtmltopdf ne
rappelle jamais le serveur, et l'interblocage reste invisible.

Dans `/etc/odoo/odoo.conf` :

```
workers = 4
```

Quatre est un plancher, pas un optimum : un pour la requête, un pour les assets,
deux de marge pour l'interface. Chaque worker occupe environ 200 Mo.

**Contrôle :** générer un PDF et vérifier qu'il aboutit sans laisser de processus
derrière lui.

```bash
pgrep -x -c wkhtmltopdf      # doit valoir 0 au repos
```

Si un rendu reste figé, purger avec `pkill -x wkhtmltopdf` — jamais `pkill -f`,
qui matcherait aussi la commande shell contenant le motif.

---

## 4. Odoo lié à localhost uniquement

**Symptôme si omis :** `http://<ip>:8069` répond depuis Internet, en clair, en
contournant nginx et TLS.

Dans `/etc/odoo/odoo.conf` :

```
http_interface = 127.0.0.1
proxy_mode = True
```

`proxy_mode` seul ne suffit pas : Odoo n'active son middleware de proxy que si la
requête porte l'en-tête `X-Forwarded-Host` (`odoo/http.py`, condition
`config['proxy_mode'] and environ.get("HTTP_X_FORWARDED_HOST")`). Sans cet
en-tête, Odoo croit toute requête en HTTP clair et réécrit `web.base.url` en
`http://`. Le snippet nginx `nginx/snippets/odoo-proxy.conf` l'envoie.

**Contrôle :**

```bash
ss -lntp | grep -E '8069|8072'        # doit afficher 127.0.0.1, pas 0.0.0.0
curl -m 5 http://<ip-publique>:8069/  # doit échouer
```

---

## 5. Droits PostgreSQL après une restauration

**Symptôme si omis :** l'API renvoie `500` sur toutes les routes, avec
`PostgresError 42501: permission denied for table users` dans
`pm2 logs lesouverain-api`. Vu de l'interface, cela ressemble à un mauvais mot de
passe alors que l'authentification n'est jamais atteinte.

**Cause :** une restauration exécutée en superutilisateur laisse les tables
appartenant à `postgres`. Posséder la base ne donne aucun droit sur ses tables.

À rejouer après chaque restauration de `lesouverain_db` :

```sql
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename AS n FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO lesouverain', r.n); END LOOP;
  FOR r IN SELECT sequencename AS n FROM pg_sequences WHERE schemaname='public' LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO lesouverain', r.n); END LOOP;
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO lesouverain;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO lesouverain;
```

Ne **jamais** utiliser `REASSIGN OWNED BY postgres` : la commande porte sur des
objets à l'échelle du cluster, bien au-delà de cette base.

---

## Vérification rapide après reconstruction

```bash
wkhtmltopdf --version | grep -q 'patched qt' && echo 'pdf ok'
/opt/odoo/venv/bin/python -c 'import geoip2' && echo 'geoip2 ok'
grep -qE '^workers = [4-9]' /etc/odoo/odoo.conf && echo 'workers ok'
ss -lntp | grep -q '127.0.0.1:8069' && echo 'odoo confine ok'
sudo -u postgres psql -d lesouverain_db -tAc \
  "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tableowner<>'lesouverain';"
  # doit renvoyer 0
```
