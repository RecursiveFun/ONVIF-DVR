/**
 * Catches render errors in child trees and shows a recoverable fallback
 * instead of blanking the whole app.
 */
import { Component } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <Box className="placeholder page-placeholder" sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Something went wrong</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {this.state.error.message || 'An unexpected error occurred.'}
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </Box>
    );
  }
}
