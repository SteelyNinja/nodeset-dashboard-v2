// Privacy-first analytics service
// Only tracks aggregated, non-personal data

interface AnalyticsEvent {
  type: 'page_view' | 'tab_switch' | 'download' | 'refresh' | 'session_start' | 'session_end' | 'operator_dashboard_view' | 'navigation';
  timestamp: number;
  data?: {
    tab?: string;
    downloadType?: string;
    sessionDuration?: number;
    userAgent?: string;
    screenWidth?: number;
    referrer?: string;
    operatorAddress?: string;
    fromPage?: string;
    toPage?: string;
  };
}


class AnalyticsService {
  private sessionId: string;
  private sessionStart: number;
  private currentTab: string = 'Information';
  private events: AnalyticsEvent[] = [];
  private isEnabled: boolean = true;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStart = Date.now();
    this.initSession();
    this.setupEventListeners();
  }

  private generateSessionId(): string {
    // Generate anonymous session ID (no personal info)
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private initSession(): void {
    this.trackEvent('session_start', {
      userAgent: this.getAnonymizedUserAgent(),
      screenWidth: window.screen.width,
      referrer: this.getAnonymizedReferrer()
    });
  }

  private getAnonymizedUserAgent(): string {
    const ua = navigator.userAgent;
    // Only extract browser and OS, remove version numbers and personal identifiers
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Other';
  }

  private getAnonymizedReferrer(): string {
    try {
      const referrer = document.referrer;
      if (!referrer) return 'direct';
      const domain = new URL(referrer).hostname;
      // Only track if it's from major search engines or direct
      if (domain.includes('google')) return 'google';
      if (domain.includes('bing')) return 'bing';
      if (domain.includes('duckduckgo')) return 'duckduckgo';
      return 'other_site';
    } catch {
      return 'unknown';
    }
  }

  private setupEventListeners(): void {
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.endSession();
      }
    });

    // Track when user leaves
    window.addEventListener('beforeunload', () => {
      this.endSession();
    });
  }

  public trackEvent(type: AnalyticsEvent['type'], data?: AnalyticsEvent['data']): void {
    if (!this.isEnabled) return;

    const event: AnalyticsEvent = {
      type,
      timestamp: Date.now(),
      data
    };

    this.events.push(event);
    this.sendToBackend(event);
  }

  public trackTabSwitch(newTab: string): void {
    if (newTab !== this.currentTab) {
      this.trackEvent('tab_switch', { tab: newTab });
      this.currentTab = newTab;
    }
  }

  public trackDownload(downloadType: string): void {
    this.trackEvent('download', { downloadType });
  }

  public trackRefresh(): void {
    this.trackEvent('refresh');
  }

  public trackOperatorDashboard(operatorAddress: string): void {
    this.trackEvent('operator_dashboard_view', { 
      operatorAddress: operatorAddress.substring(0, 10) + '...' // Anonymize the address 
    });
  }

  public trackNavigation(fromPage: string, toPage: string): void {
    this.trackEvent('navigation', { fromPage, toPage });
  }

  private endSession(): void {
    const sessionDuration = Date.now() - this.sessionStart;
    this.trackEvent('session_end', { sessionDuration });
  }

  private async sendToBackend(event: AnalyticsEvent): Promise<void> {
    try {
      // Send to our backend analytics endpoint
      const baseUrl = process.env.REACT_APP_API_URL || '';
      await fetch(`${baseUrl}/api/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          event
        })
      });
    } catch (error) {
      // Silently fail - analytics shouldn't break the app
      console.debug('Analytics tracking failed:', error);
    }
  }

  // Method to disable analytics if user opts out
  public disable(): void {
    this.isEnabled = false;
  }

  public enable(): void {
    this.isEnabled = true;
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
export default analyticsService;