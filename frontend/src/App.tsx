import { Box, Typography, Button, AppBar, Toolbar, Container, Grid, Paper } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Chat from './components/Chat';
import DocumentManager from './components/DocumentManager';
import API_CONFIG from './config/api';
import './App.css';

function MainContent() {
  const { user, token, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Generate a session ID for the chat (you might want to get this from the auth context)
  const sessionId = user?.sessionId || `session-${Date.now()}`;

  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            AWS Claude RAG Chatbot
          </Typography>
          <Typography variant="body1" sx={{ mr: 2 }}>
            Welcome, {user?.username}
          </Typography>
          <Button color="inherit" onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ flexGrow: 1, py: 3, overflow: 'hidden' }}>
        <Grid container spacing={3} sx={{ height: '100%' }}>
          {/* Document Management Panel */}
          <Grid size={{ xs: 12, md: 4, lg: 3 }}>
            <Paper
              elevation={3}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'auto'
              }}
            >
              <DocumentManager />
            </Paper>
          </Grid>

          {/* Chat Interface */}
          <Grid size={{ xs: 12, md: 8, lg: 9 }}>
            <Paper
              elevation={3}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {token && user ? (
                <Chat
                  token={token}
                  userId={user.userId}
                  sessionId={sessionId}
                  websocketUrl={API_CONFIG.wsUrl}
                />
              ) : (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body1" color="text.secondary">
                    Loading chat...
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <MainContent />
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;
