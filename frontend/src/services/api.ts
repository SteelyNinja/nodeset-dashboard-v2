import axios, { AxiosResponse } from 'axios';
import {
  ApiResponse,
  HealthResponse,
  DataFilesHealthResponse,
  ValidatorData,
  ConcentrationMetrics,
  PerformanceAnalysis,
  ProposalsData,
  MissedProposalsData,
  ValidatorPerformanceData,
  ExitData,
  GasAnalysis,
  ClientDiversity,
  SyncCommitteeData,
} from '../types/api';

const API_BASE_URL = process.env.REACT_APP_API_URL;

class ApiService {
  private apiClient;

  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.apiClient.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Response Error:', error);
        if (error.response?.status === 500) {
          throw new Error('Internal server error. Please try again later.');
        } else if (error.response?.status === 404) {
          throw new Error('Data not found. Please check if the backend is running.');
        } else if (error.code === 'ECONNREFUSED') {
          throw new Error('Cannot connect to backend. Please ensure the FastAPI server is running on port 8000.');
        }
        throw error;
      }
    );
  }

  // Helper method to extract data from API response
  private extractData<T>(response: AxiosResponse<ApiResponse<T>>): T {
    return response.data.data;
  }

  // Health endpoints
  async getHealth(): Promise<HealthResponse> {
    const response = await this.apiClient.get<ApiResponse<HealthResponse>>('/health/');
    return this.extractData(response);
  }

  async getDataFilesHealth(): Promise<DataFilesHealthResponse> {
    const response = await this.apiClient.get<ApiResponse<DataFilesHealthResponse>>('/health/data-files');
    return this.extractData(response);
  }

  // Data endpoints
  async getValidatorData(): Promise<ValidatorData> {
    const response = await this.apiClient.get<ApiResponse<ValidatorData>>('/api/data/validator-data');
    return this.extractData(response);
  }

  async getProposalsData(): Promise<ProposalsData> {
    const response = await this.apiClient.get<ApiResponse<ProposalsData>>('/api/data/proposals');
    return this.extractData(response);
  }

  async getMissedProposalsData(): Promise<MissedProposalsData> {
    const response = await this.apiClient.get<ApiResponse<MissedProposalsData>>('/api/data/missed-proposals');
    return this.extractData(response);
  }

  async getValidatorPerformanceData(): Promise<ValidatorPerformanceData> {
    const response = await this.apiClient.get<ApiResponse<ValidatorPerformanceData>>('/api/data/validator-performance');
    return this.extractData(response);
  }

  async getExitData(): Promise<ExitData> {
    const response = await this.apiClient.get<ApiResponse<ExitData>>('/api/data/exit-data');
    return this.extractData(response);
  }

  async getSyncCommitteeData(): Promise<SyncCommitteeData> {
    const response = await this.apiClient.get<ApiResponse<SyncCommitteeData>>('/api/data/sync-committee');
    return this.extractData(response);
  }

  // Dashboard analytics endpoints
  async getConcentrationMetrics(): Promise<ConcentrationMetrics> {
    const response = await this.apiClient.get<ApiResponse<ConcentrationMetrics>>('/api/dashboard/concentration-metrics');
    return this.extractData(response);
  }

  async getPerformanceAnalysis(): Promise<PerformanceAnalysis> {
    const response = await this.apiClient.get<ApiResponse<PerformanceAnalysis>>('/api/dashboard/performance-analysis');
    return this.extractData(response);
  }

  async getGasAnalysis(): Promise<GasAnalysis> {
    const response = await this.apiClient.get<ApiResponse<GasAnalysis>>('/api/dashboard/gas-analysis');
    return this.extractData(response);
  }

  async getClientDiversity(): Promise<ClientDiversity> {
    const response = await this.apiClient.get<ApiResponse<ClientDiversity>>('/api/dashboard/client-diversity');
    return this.extractData(response);
  }

  async getAllExitRecords(): Promise<ExitData> {
    const response = await this.apiClient.get<ApiResponse<ExitData>>('/api/dashboard/all-exit-records');
    return this.extractData(response);
  }

  // Generic data fetcher for any dataset
  async getData<T>(dataset: string): Promise<T> {
    const response = await this.apiClient.get<ApiResponse<T>>(`/api/data/${dataset}`);
    return this.extractData(response);
  }

  // Get cache timestamp from validator data (nodeset_validator_tracker_cache.json)
  async getCacheTimestamp(): Promise<string | null> {
    try {
      const validatorData = await this.getValidatorData();
      return validatorData.last_updated;
    } catch (error) {
      console.error('Failed to get cache timestamp:', error);
      return null;
    }
  }

  // Utility methods
  async checkBackendConnection(): Promise<boolean> {
    try {
      await this.getHealth();
      return true;
    } catch (error) {
      console.error('Backend connection failed:', error);
      return false;
    }
  }

  async checkDataAvailability(): Promise<boolean> {
    try {
      const health = await this.getDataFilesHealth();
      return health.status === 'healthy';
    } catch (error) {
      console.error('Data availability check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
