import { AxiosError } from 'axios';

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof AxiosError && err.response?.data) {
    const data = err.response.data as ApiError;
    if (Array.isArray(data.message)) {
      return data.message.join(', ');
    }
    if (typeof data.message === 'string') {
      return data.message;
    }
    return data.error || 'Something went wrong';
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Something went wrong';
}
