/**
 * Modal confirmation for destructive or irreversible actions.
 * Blocks dismiss while `confirming` so double-submit cannot close the dialog.
 */
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirming = false,
  confirmColor = 'error',
  onConfirm,
  onCancel,
  children,
}) {
  return (
    <Dialog open={open} onClose={confirming ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">{description}</DialogContentText>
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={confirming}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          color={confirmColor}
          variant="contained"
          disabled={confirming}
        >
          {confirming ? `${confirmLabel}…` : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
