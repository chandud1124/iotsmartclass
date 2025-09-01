import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
  deviceName: string;
}

const DeleteDeviceDialog: React.FC<DeleteDeviceDialogProps> = ({ open, onOpenChange, onConfirm, loading, deviceName }) => {
  const [inputValue, setInputValue] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the device and remove all its data.<br />
            Please type <b>{deviceName}</b> to confirm deletion.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (inputValue === deviceName) onConfirm();
          }}
        >
          <input
            type="text"
            className="w-full border rounded px-3 py-2 mb-4 bg-background text-foreground placeholder:text-muted-foreground"
            placeholder={`Type '${deviceName}' to confirm`}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            disabled={loading}
          />
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button variant="destructive" type="submit" disabled={loading || inputValue !== deviceName}>
              {loading ? 'Deleting...' : 'Delete Device'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteDeviceDialog;
