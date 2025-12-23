'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Upload, File, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UploadedFile {
    id: number;
    filename: string;
    file_size: number;
    file_type: string;
}

interface FileUploaderProps {
    onFilesChange: (fileIds: number[]) => void;
    maxFiles?: number;
    maxFileSize?: number; // in MB
}

export default function FileUploader({
    onFilesChange,
    maxFiles = 5,
    maxFileSize = 10
}: FileUploaderProps) {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const uploadFile = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/files/upload', {
            method: 'POST',
            credentials: 'include',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '파일 업로드 실패');
        }

        return await response.json();
    };

    const handleFiles = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;

        if (files.length + fileList.length > maxFiles) {
            toast.error(`최대 ${maxFiles}개의 파일만 업로드할 수 있습니다.`);
            return;
        }

        setUploading(true);

        try {
            const uploadPromises = Array.from(fileList).map(async (file) => {
                // 파일 크기 체크
                if (file.size > maxFileSize * 1024 * 1024) {
                    toast.error(`${file.name}: 파일 크기가 ${maxFileSize}MB를 초과합니다.`);
                    return null;
                }

                try {
                    const uploadedFile = await uploadFile(file);
                    return uploadedFile;
                } catch (error: any) {
                    toast.error(`${file.name}: ${error.message}`);
                    return null;
                }
            });

            const results = await Promise.all(uploadPromises);
            const successfulUploads = results.filter((r): r is UploadedFile => r !== null);

            if (successfulUploads.length > 0) {
                const newFiles = [...files, ...successfulUploads];
                setFiles(newFiles);
                onFilesChange(newFiles.map(f => f.id));
                toast.success(`${successfulUploads.length}개 파일이 업로드되었습니다.`);
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('파일 업로드 중 오류가 발생했습니다.');
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    }, [files, maxFiles, maxFileSize]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    };

    const removeFile = async (fileId: number) => {
        try {
            const response = await fetch(`/api/files/upload/${fileId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('파일 삭제 실패');
            }

            const newFiles = files.filter(f => f.id !== fileId);
            setFiles(newFiles);
            onFilesChange(newFiles.map(f => f.id));
            toast.success('파일이 삭제되었습니다.');
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('파일 삭제 중 오류가 발생했습니다.');
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const getFileIcon = (fileType: string) => {
        if (fileType.startsWith('image/')) {
            return <ImageIcon className="w-4 h-4" />;
        } else if (fileType === 'application/pdf') {
            return <FileText className="w-4 h-4" />;
        } else {
            return <File className="w-4 h-4" />;
        }
    };

    return (
        <div className="space-y-4">
            {/* Upload Area */}
            <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragActive
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    id="file-upload"
                    multiple
                    onChange={handleChange}
                    className="hidden"
                    disabled={uploading || files.length >= maxFiles}
                />

                <label
                    htmlFor="file-upload"
                    className={`cursor-pointer ${uploading || files.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <Upload className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                    <p className="text-sm text-slate-600 mb-1">
                        파일을 드래그하거나 클릭하여 업로드
                    </p>
                    <p className="text-xs text-slate-400">
                        최대 {maxFiles}개, 파일당 최대 {maxFileSize}MB
                    </p>
                </label>

                {uploading && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">업로드 중...</span>
                    </div>
                )}
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">
                        첨부파일 ({files.length}/{maxFiles})
                    </p>
                    <div className="space-y-2">
                        {files.map((file) => (
                            <div
                                key={file.id}
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="text-slate-600">
                                        {getFileIcon(file.file_type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">
                                            {file.filename}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {formatFileSize(file.file_size)}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeFile(file.id)}
                                    className="text-slate-400 hover:text-red-600"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
