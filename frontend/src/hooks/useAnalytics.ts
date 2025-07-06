import { useCallback } from 'react';
import { analyticsService } from '../services/analytics';

export const useAnalytics = () => {
  const trackDownload = useCallback((downloadType: string) => {
    analyticsService.trackDownload(downloadType);
  }, []);

  const trackTabSwitch = useCallback((tab: string) => {
    analyticsService.trackTabSwitch(tab);
  }, []);

  const trackRefresh = useCallback(() => {
    analyticsService.trackRefresh();
  }, []);

  return {
    trackDownload,
    trackTabSwitch,
    trackRefresh
  };
};

export default useAnalytics;