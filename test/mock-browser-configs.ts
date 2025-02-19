import { BaseBrowserConfig, type PlatformConfig, type SupportedArch } from '../src/browser-base-config.ts'
import { testBrowsers } from './mock-configs.ts'

const mockPlatformConfig: Record<string, PlatformConfig> = {
  windows: {
    arch: ['x64', 'arm64'] as SupportedArch[],
    installPathTemplate: 'mock/path',
    executableTemplate: 'mock/executable'
  },
  mac: {
    arch: ['x64', 'arm64'] as SupportedArch[],
    installPathTemplate: 'mock/path',
    executableTemplate: 'mock/executable'
  },
  linux: {
    arch: ['x64', 'arm64'] as SupportedArch[],
    installPathTemplate: 'mock/path',
    executableTemplate: 'mock/executable'
  }
}

class MockBrowserConfig extends BaseBrowserConfig {
  constructor(
    name: string,
    private mockVersion: string
  ) {
    super(name, mockPlatformConfig)
  }

  override async getLatestVersion(): Promise<string> {
    return this.mockVersion
  }
}

export const chrome = new MockBrowserConfig('chrome', testBrowsers.chrome.version)
export const chromium = new MockBrowserConfig('chromium', testBrowsers.chromium.version)
export const edge = new MockBrowserConfig('edge', testBrowsers.edge.version)
export const brave = new MockBrowserConfig('brave', testBrowsers.brave.version)
export const arc = new MockBrowserConfig('arc', '0.1.0') // Mock version for Arc 