# Proposal: Local ZMK/QMK Build Support for CLI

## Executive Summary

The current CLI implementation in this repository is heavily dependent on GitHub Actions workflows for firmware building and flashing. This proposal outlines enhancements to support local ZMK and QMK builds, providing developers with more flexibility and faster development cycles. The solution maintains backward compatibility with existing GitHub-based workflows while enabling a local build option.

## Current System Analysis

### GitHub Workflow Dependencies

The system is built around two primary GitHub Actions workflows:
- `.github/workflows/build-zmk.yml` - Handles ZMK firmware builds
- `.github/workflows/build-qmk.yml` - Handles QMK firmware builds

These workflows:
- Require GitHub authentication tokens
- Depend on network connectivity for all operations
- Store artifacts in GitHub's artifact storage system
- Can be time-consuming for iterative development

### CLI Components
- `firmware.status.cli.tsx` - Shows build status from GitHub
- `firmware.flash.cli.tsx` - Downloads and flashes firmware artifacts
- `firmware.service.ts` - Core service layer coordinating with GitHub API
- `gh.ts` - GitHub API interaction utilities

## Proposed Implementation

### 1. Local Build Capability Enhancement

The CLI should be able to build firmware locally when appropriate tools are installed, with automatic fallback to GitHub workflows:

#### ZMK Local Building Support:
- Detect `west` tool presence
- Execute `west build` for ZMK firmware compilation
- Use `west flash` for hardware flashing when supported
- Handle artifact management for local builds

#### QMK Local Building Support:
- Detect `qmk` command availability  
- Execute `qmk compile` for firmware compilation
- Use `qmk flash` or direct programming tools for flashing
- Properly handle QMK's keymap configurations

### 2. Enhanced Architecture

The firmware service layer should be enhanced to detect and switch between environments:

```typescript
export default class FirmwareService extends BaseService {
  // Enhanced find method to try local builds first
  async *find(params: Params): AsyncGenerator<ServiceEvent<StatusMap>> {
    const { keyboards } = params as any;
    
    if (this.canBuildLocally()) {
      // Try local builds first when tools available
      const localStatus = await this.getLocalStatus(keyboards);
      yield ["status", "local", localStatus];
    } else {
      // Fallback to GitHub workflow approach
      const ghStatus = await this.getGHStatus(keyboards);
      yield ["status", "gh", ghStatus];
    }
  }
  
  private canBuildLocally(): boolean {
    // Check for local tooling presence
    return this.hasWestTools() || this.hasQmkTools();
  }
}
```

### 3. Configuration and User Control

Add explicit command-line controls for building preferences:

```bash
# Build and flash with local tools (if available)
zmk flash corne left --local

# Force GitHub workflow
zmk flash corne left --no-local

# Default behavior (detects local tools automatically)
zmk flash corne left
```

### 4. Configuration Options

Allow configuration through `local.json` or similar:

```json
{
  "localBuild": {
    "enabled": true,
    "buildTools": {
      "zmk": {
        "westPath": "/usr/local/bin/west",
        "buildDirectory": "./build-local"
      },
      "qmk": {
        "qmkPath": "/usr/local/bin/qmk",
        "keyboardsDirectory": "./keyboards/"
      }
    }
  }
}
```

## Benefits

### Development Experience Improvements
- **Offline Development**: Build firmware without internet connectivity
- **Faster Iterations**: No waiting for GitHub Actions execution
- **Better Debugging**: Easier to debug build failures locally
- **Reduced Dependency**: No need for GitHub credentials for basic operations

### Performance Advantages
- Eliminate network overhead for repeated builds
- Faster feedback for development cycles
- Reduced resource consumption on GitHub infrastructure

## Implementation Strategy

### Phase 1: Environment Detection
- Add logic to detect local ZMK/QMK tooling presence
- Implement fallback mechanisms
- Create environment validation utilities

### Phase 2: Local Build Implementation
- Add ZMK local build support using `west build`
- Add QMK local build support using `qmk compile`
- Implement artifact handling for local builds

### Phase 3: CLI Enhancement
- Add `--local` and `--no-local` flags
- Update command descriptions and help text
- Implement automatic fallback when local builds fail

### Phase 4: Integration and Testing
- Comprehensive integration testing
- Cross-platform compatibility verification
- Performance benchmarking

## Technical Considerations

### Error Handling
- When local tools are missing, gracefully fall back to GitHub workflow approach
- Provide helpful error messages for tool installation guidance
- Support graceful degradation of functionality

### Cross-Platform Compatibility
- Support for macOS, Linux, and Windows development environments
- Handle different path conventions and tool installation methods
- Ensure consistent interface regardless of environment

## Migration Plan

The implementation will be backward compatible, preserving all existing functionality while introducing enhanced local build capabilities. Users can gradually adopt the local build features without changing their workflows.

## Conclusion

This enhancement will make the CLI more flexible and developer-friendly by allowing local builds when appropriate tools are present. It maintains full backward compatibility with existing GitHub workflows while providing better performance, offline capability, and improved developer experience for firmware development.