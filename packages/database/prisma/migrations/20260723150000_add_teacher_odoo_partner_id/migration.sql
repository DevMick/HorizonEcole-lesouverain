-- Track the linked Odoo res.partner contact id for each teacher, so the
-- automatic sync (create-on-create, update-on-update) knows whether to
-- create a new Odoo contact or update the existing one instead of relying
-- solely on email/phone matching. Mirrors parents.odoo_partner_id.
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "odoo_partner_id" INTEGER;
