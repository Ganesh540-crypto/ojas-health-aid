import React from 'react';
import { X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FilePreviewProps {
  file: File;
  onRemove: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ file, onRemove }) => {
  const isImage = file.type.startsWith('image/');
  const isPDF = file.type === 'application/pdf';
  
  return (
    <Card className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="absolute -top-2 -right-2 h-6 w-6 p-0 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full"
      >
        <X className="h-3 w-3" />
      </Button>
      <CardContent className="p-3">
        {isImage ? (
          <div className="flex flex-col items-center gap-2">
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="max-w-32 max-h-32 rounded object-cover"
            />
            <span className="text-xs text-muted-foreground truncate max-w-32">
              {file.name}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {isPDF ? (
              <FileText className="h-8 w-8 text-destructive" />
            ) : (
              <FileText className="h-8 w-8 text-muted-foreground" />
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">
                {file.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            <Badge variant="outline" className="ml-auto">
              {file.type || 'file'}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};