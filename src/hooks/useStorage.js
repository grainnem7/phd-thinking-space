import { useState, useCallback } from 'react';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from '../lib/firebase';
import { useAuth } from './useAuth';

export const DEMO_UPLOAD_MESSAGE = 'Sign in to attach PDFs. Files can’t be uploaded in demo mode.';

export function useStorage() {
  const { user, isDemo } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  // Demo sessions share one "demo-user" id, so nothing may be written to Storage.
  const canUpload = Boolean(user) && !isDemo;

  const uploadFile = useCallback(async (file, path) => {
    if (!user) {
      throw new Error('Must be logged in to upload files');
    }
    if (isDemo) {
      setError(DEMO_UPLOAD_MESSAGE);
      throw new Error(DEMO_UPLOAD_MESSAGE);
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Create a unique filename with timestamp
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fullPath = `${path}/${timestamp}_${safeName}`;
      const storageRef = ref(storage, fullPath);

      // Upload with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file);

      return await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (err) => {
            setError(err.message);
            setUploading(false);
            reject(err);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setUploadProgress(100);
              resolve({
                url: downloadURL,
                path: fullPath,
                name: file.name,
                size: file.size,
                type: file.type,
              });
            } catch (err) {
              setError(err.message);
              reject(err);
            } finally {
              setUploading(false);
            }
          }
        );
      });
    } catch (err) {
      setError(err.message);
      setUploading(false);
      throw err;
    }
  }, [user, isDemo]);

  const deleteFile = useCallback(async (filePath) => {
    if (!filePath) return;
    if (isDemo) throw new Error(DEMO_UPLOAD_MESSAGE);

    try {
      const fileRef = ref(storage, filePath);
      await deleteObject(fileRef);
    } catch (err) {
      // Ignore errors for files that don't exist
      if (err.code !== 'storage/object-not-found') {
        console.error('Error deleting file:', err);
        throw err;
      }
    }
  }, [isDemo]);

  const getFileUrl = useCallback(async (filePath) => {
    if (!filePath) return null;

    try {
      const fileRef = ref(storage, filePath);
      return await getDownloadURL(fileRef);
    } catch (err) {
      console.error('Error getting file URL:', err);
      return null;
    }
  }, []);

  return {
    uploadFile,
    deleteFile,
    getFileUrl,
    canUpload,
    uploading,
    uploadProgress,
    error,
  };
}
