import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

export default function DirectoryPicker({ open, initialPath, onSelect, onClose }) {
  const [roots, setRoots] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadDirectory = useCallback(async (dirPath) => {
    setLoading(true);
    setError('');
    try {
      const listing = await api.listDirectory(dirPath);
      setCurrentPath(listing.path);
      setParentPath(listing.parent);
      setEntries(listing.entries);
    } catch (err) {
      setError(err.message || 'Failed to load folder');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setError('');

    (async () => {
      setLoading(true);
      try {
        const { roots: rootList } = await api.listFsRoots();
        if (cancelled) return;
        setRoots(rootList);
        await loadDirectory(initialPath || rootList[0]?.path || '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to open folder browser');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, initialPath, loadDirectory]);

  const handleSelect = () => {
    if (!currentPath) return;
    onSelect?.(currentPath);
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Choose recordings folder</DialogTitle>
      <DialogContent dividers>
        {roots.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {roots.map((root) => (
              <Chip
                key={root.path}
                label={root.label}
                size="small"
                color={currentPath === root.path ? 'primary' : 'default'}
                onClick={() => loadDirectory(root.path)}
                clickable
              />
            ))}
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, wordBreak: 'break-all' }}>
          {currentPath || '—'}
        </Typography>

        <Box sx={{ mb: 1 }}>
          <Button
            size="small"
            startIcon={<ArrowUpwardIcon />}
            onClick={() => parentPath && loadDirectory(parentPath)}
            disabled={!parentPath || loading}
          >
            Up
          </Button>
        </Box>

        <List
          dense
          sx={{
            maxHeight: 'min(320px, 45vh)',
            overflow: 'auto',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
          }}
          aria-label="Folders"
        >
          {loading && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
              Loading…
            </Typography>
          )}
          {!loading && error && (
            <Alert severity="error" sx={{ m: 1 }}>{error}</Alert>
          )}
          {!loading && !error && entries.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
              No subfolders
            </Typography>
          )}
          {!loading && !error && entries.map((entry) => (
            <ListItemButton key={entry.path} onClick={() => loadDirectory(entry.path)}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <FolderOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={entry.name} />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSelect} disabled={!currentPath || loading}>
          Select this folder
        </Button>
      </DialogActions>
    </Dialog>
  );
}
