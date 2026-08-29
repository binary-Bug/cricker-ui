/**
 * Axiom Cloud Logging Utility
 * Integrates with Axiom cloud logging service using native fetch API
 * Supports different log levels and automatic device/IP tracking
 */

interface LogPayload {
  _time: string;
  level: 'info' | 'warn' | 'error';
  message?: string;
  event?: string;
  app: 'cricker-ui';
  [key: string]: any;
}

interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
  screen: {
    width: number;
    height: number;
  };
  hostname?: string;
  ipAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    city?: string;
    country?: string;
  };
}

class AxiomLogger {
  private readonly AXIOM_DATASET = 'cricker-logs';
  private readonly AXIOM_TOKEN = 'xaat-612c4f26-d42e-4849-b34a-88826cde962a';
  private readonly AXIOM_ENDPOINT = 'https://api.axiom.co/v1/datasets';
  private isDevelopment: boolean;
  private deviceInfo: DeviceInfo | null = null;

  constructor() {
    this.isDevelopment = !this.isProdEnv();
  }

  /**
   * Check if running in production environment
   */
  private isProdEnv(): boolean {
    try {
      // Try to import environment if available
      return false; // Will be overridden after environment imports
    } catch {
      return false;
    }
  }

  /**
   * Initialize the logger with environment config
   * Can be called after Angular bootstrap
   */
  public initialize(isProdEnv: boolean): void {
    this.isDevelopment = !isProdEnv;
  }

  /**
   * Get location from IP address (no user permission needed)
   */
  private async getIpGeolocation(): Promise<{
    latitude?: number;
    longitude?: number;
    city?: string;
    country?: string;
  }> {
    try {
      // ipapi.co is free and returns JSON based on client IP
      const response = await fetch('https://ipapi.co/json/', {
        method: 'GET',
        mode: 'cors',
      });
      if (response.ok) {
        const data = await response.json();
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          city: data.city,
          country: data.country_name,
        };
      }
    } catch {
      // Silently fail - geolocation is optional
    }
    return {};
  }

  /**
   * Get user's device location via geolocation API (with fallback to IP geolocation)
   */
  private async getLocation(): Promise<{
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    city?: string;
    country?: string;
  }> {
    const result: any = {};

    // Try browser geolocation first (requires user permission)
    if (navigator.geolocation) {
      try {
        const geoResult = await new Promise<GeolocationCoordinates>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (position) => resolve(position.coords),
              reject,
              { timeout: 3000, maximumAge: 3600000 },
            );
          },
        );
        result.latitude = geoResult.latitude;
        result.longitude = geoResult.longitude;
        result.accuracy = geoResult.accuracy;
      } catch {
        // User denied or error - continue to IP geolocation
      }
    }

    // Fallback to IP-based geolocation (no permission needed)
    if (!result.latitude) {
      const ipGeo = await this.getIpGeolocation();
      Object.assign(result, ipGeo);
    }

    return result;
  }

  /**
   * Gather device and user information
   */
  private async getDeviceInfo(): Promise<DeviceInfo> {
    if (this.deviceInfo) {
      return this.deviceInfo;
    }

    const deviceInfo: DeviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
      },
    };

    // Try to get IP address and hostname from browser
    try {
      const response = await fetch('https://api.ipify.org?format=json', {
        method: 'GET',
        mode: 'cors',
      });
      if (response.ok) {
        const data = await response.json();
        deviceInfo.ipAddress = data.ip;
      }
    } catch {
      // Silently fail - IP is optional
    }

    // Try to get hostname (limited by browser security)
    try {
      if (typeof window !== 'undefined' && window.location) {
        deviceInfo.hostname = window.location.hostname;
      }
    } catch {
      // Silently fail
    }

    // Try to get device location
    try {
      deviceInfo.location = await this.getLocation();
    } catch {
      // Silently fail - location is optional
    }

    this.deviceInfo = deviceInfo;
    return deviceInfo;
  }

  /**
   * Build the log payload with standardized fields
   */
  private async buildPayload(
    level: 'info' | 'warn' | 'error',
    message: string | undefined,
    event: string | undefined,
    metadata: Record<string, any> = {},
  ): Promise<LogPayload> {
    const deviceInfo = await this.getDeviceInfo();

    const payload: LogPayload = {
      _time: new Date().toISOString(),
      level,
      app: 'cricker-ui',
      ...deviceInfo,
      ...metadata,
    };

    if (message) {
      payload.message = message;
    }
    if (event) {
      payload.event = event;
    }

    return payload;
  }

  /**
   * Send log payload to Axiom
   */
  private async sendToAxiom(payload: LogPayload): Promise<void> {
    try {
      const url = `${this.AXIOM_ENDPOINT}/${this.AXIOM_DATASET}/ingest`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.AXIOM_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        keepalive: true, // Ensure log completes even during navigation
      });

      if (!response.ok) {
        console.warn(`Axiom logging failed with status ${response.status}`);
      }
    } catch (error) {
      // Fail silently - logging should never crash the app
      if (this.isDevelopment) {
        console.error('Axiom logging error:', error);
      }
    }
  }

  /**
   * Log info level message
   */
  public async info(
    message: string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    const payload = await this.buildPayload(
      'info',
      message,
      undefined,
      metadata,
    );

    if (this.isDevelopment) {
      console.log(`[INFO] ${message}`, payload);
    }

    // Always send to Axiom (dev and prod)
    await this.sendToAxiom(payload);
  }

  /**
   * Log warning level message
   */
  public async warn(
    message: string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    const payload = await this.buildPayload(
      'warn',
      message,
      undefined,
      metadata,
    );

    if (this.isDevelopment) {
      console.warn(`[WARN] ${message}`, payload);
    }

    // Always send to Axiom (dev and prod)
    await this.sendToAxiom(payload);
  }

  /**
   * Log error level message
   */
  public async error(
    message: string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    const payload = await this.buildPayload(
      'error',
      message,
      undefined,
      metadata,
    );

    if (this.isDevelopment) {
      console.error(`[ERROR] ${message}`, payload);
    }

    // Always send to Axiom (dev and prod)
    await this.sendToAxiom(payload);
  }

  /**
   * Track custom event
   */
  public async trackEvent(
    eventName: string,
    data: Record<string, any> = {},
  ): Promise<void> {
    const payload = await this.buildPayload('info', undefined, eventName, data);

    if (this.isDevelopment) {
      console.log(`[EVENT] ${eventName}`, payload);
    }

    // Always send to Axiom (dev and prod)
    await this.sendToAxiom(payload);
  }
}

// Create and export singleton instance
export const logger = new AxiomLogger();
