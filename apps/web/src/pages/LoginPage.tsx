import { useState } from 'react';
import { Form, Input, Button, Alert, message } from 'antd';
import { LockOutlined, LoginOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { roleHome } from '../lib/navigation/role-home';
import { ThemeToggle } from '../components/theme/ThemeToggle';

interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const onFinish = async (values: LoginFormValues) => {
    try {
      setIsLoading(true);
      setError('');

      // Clear any existing tokens before login attempt to prevent conflicts
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('auth-storage');

      const response = await authApi.login(values);

      if (response.data.success) {
        const { user, accessToken } = response.data.data;
        login(user, accessToken);
        message.success(`Bienvenue ${user.firstName} !`);
        navigate(roleHome(user.role));
      } else {
        setError('Identifiants incorrects');
      }
    } catch (err: any) {
      console.error('Login error:', err);

      // Enhanced error handling with detailed messages
      let errorMessage = 'Erreur de connexion. Veuillez réessayer.';

      if (err.response) {
        // Server responded with error
        const serverError = err.response.data;
        const status = err.response.status;

        // Handle specific error cases
        if (status === 401) {
          // Authentication errors
          if (serverError?.code === 'TOKEN_MISSING' || serverError?.error === 'Authentication Required') {
            // This shouldn't happen on login, but if it does, clear tokens and show appropriate message
            console.warn('Unexpected authentication error on login - this may indicate a configuration issue');
            errorMessage = 'Erreur d\'authentification. Veuillez réessayer.';
          } else {
            errorMessage = serverError?.error || serverError?.message || 'Identifiants incorrects';
          }
        } else if (status === 400) {
          errorMessage = serverError?.error || serverError?.message || 'Données invalides';
        } else if (status === 500) {
          errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
        } else {
          errorMessage = serverError?.error || serverError?.message || errorMessage;
        }

        // Include details in development mode
        if (import.meta.env.DEV && serverError?.details) {
          console.error('Server error details:', serverError.details);
        }
      } else if (err.request) {
        // Request was made but no response received
        errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion.';
      } else if (err.message) {
        // Something else happened
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-he">
      {/* Décor d'arrière-plan sobre, dérivé de l'accent de rôle (§ principe 1) */}
      <div className="login-he-backdrop" aria-hidden="true">
        <div className="login-he-glow login-he-glow-1" />
        <div className="login-he-glow login-he-glow-2" />
        <div className="login-he-grid" />
      </div>

      {/* Bascule clair/sombre — seul réglage de démonstration conservé en prod (§13) */}
      <div className="login-he-toolbar">
        <ThemeToggle />
      </div>

      <div className="login-he-panel">
        {/* En-tête : logo, marque, sous-titre */}
        <header className="login-he-header">
          <button
            type="button"
            className="login-he-logo"
            onClick={() => navigate('/')}
            aria-label="Accueil HorizonEcole"
          >
            HE
          </button>
          <h1 className="login-he-title">HorizonEcole</h1>
          <p className="login-he-subtitle">Connectez-vous à votre espace de gestion</p>
          <span className="login-he-accent-bar" aria-hidden="true" />
        </header>

        {/* Carte de connexion — languette « dossier » signature en haut à gauche */}
        <section className="login-he-card">
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError('')}
              className="login-he-alert"
            />
          )}

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            layout="vertical"
            requiredMark={false}
            size="large"
            autoComplete="off"
            className="login-he-form"
          >
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Veuillez saisir votre email' },
                { type: 'email', message: 'Veuillez saisir un email valide' },
              ]}
            >
              <Input
                placeholder="admin@souverainlarabia.edu.ci"
                size="large"
                prefix={<MailOutlined className="login-he-input-icon" />}
                className="login-he-input"
                autoComplete="email"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Mot de passe"
              rules={[
                { required: true, message: 'Veuillez saisir votre mot de passe' },
                { min: 6, message: 'Minimum 6 caractères' },
              ]}
            >
              <Input.Password
                placeholder="Saisissez votre mot de passe"
                size="large"
                prefix={<LockOutlined className="login-he-input-icon" />}
                className="login-he-input"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item className="login-he-submit-item">
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={isLoading}
                icon={<LoginOutlined />}
                className="login-he-submit"
                block
              >
                {isLoading ? 'Connexion...' : 'Se connecter'}
              </Button>
            </Form.Item>
          </Form>
        </section>

        <footer className="login-he-footer">
          École Le Souverain · Gestion scolaire
        </footer>
      </div>
    </div>
  );
}
