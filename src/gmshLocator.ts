import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface GmshDetectResult {
  found: boolean;
  path: string;
  version?: string;
  source?: 'config' | 'path' | 'auto-search' | 'fallback';
}

export class GmshLocator {
  private static cachedResult: GmshDetectResult | null = null;

  /**
   * Reset the cached detection result.
   */
  public static clearCache() {
    this.cachedResult = null;
  }

  /**
   * Find Gmsh executable automatically across standard directories and PATH.
   */
  public static async findGmsh(configuredPath?: string): Promise<GmshDetectResult> {
    if (this.cachedResult && this.cachedResult.found) {
      if (!configuredPath || configuredPath === this.cachedResult.path) {
        return this.cachedResult;
      }
    }

    // 1. Check configured path first if it is explicitly provided (and not default 'gmsh')
    if (configuredPath && configuredPath !== 'gmsh') {
      const verified = await this.verifyGmshExecutable(configuredPath);
      if (verified.found) {
        this.cachedResult = { ...verified, source: 'config' };
        return this.cachedResult;
      }
    }

    // 2. Check system PATH ('gmsh' / 'where gmsh' / 'which gmsh')
    const pathResult = await this.checkSystemPath();
    if (pathResult.found) {
      this.cachedResult = { ...pathResult, source: 'path' };
      return this.cachedResult;
    }

    // 3. Scan common filesystem locations
    const candidatePaths = this.getCandidateSearchPaths();
    for (const cand of candidatePaths) {
      if (fs.existsSync(cand)) {
        const verified = await this.verifyGmshExecutable(cand);
        if (verified.found) {
          this.cachedResult = { ...verified, source: 'auto-search' };
          return this.cachedResult;
        }
      }
    }

    this.cachedResult = {
      found: false,
      path: configuredPath || 'gmsh',
      source: 'fallback'
    };
    return this.cachedResult;
  }

  /**
   * Check if 'gmsh' is accessible via system PATH.
   */
  private static async checkSystemPath(): Promise<GmshDetectResult> {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'where.exe gmsh' : 'which gmsh';

    return new Promise((resolve) => {
      cp.exec(cmd, { timeout: 2000 }, async (err, stdout) => {
        if (!err && stdout) {
          const firstPath = stdout.trim().split(/\r?\n/)[0].trim();
          if (firstPath) {
            const verified = await this.verifyGmshExecutable(firstPath);
            if (verified.found) {
              resolve(verified);
              return;
            }
          }
        }
        resolve({ found: false, path: 'gmsh' });
      });
    });
  }

  /**
   * Gather a list of candidate executable paths based on OS and wildcard directories.
   */
  public static getCandidateSearchPaths(): string[] {
    const candidates: string[] = [];
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    if (isWin) {
      const userProfile = process.env.USERPROFILE || '';
      const localAppData = process.env.LOCALAPPDATA || '';
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

      const searchDirs = [
        programFiles,
        programFilesX86,
        'C:\\',
        path.join(userProfile, 'Downloads'),
        path.join(userProfile, 'Desktop'),
        userProfile,
        path.join(localAppData, 'Programs'),
        'C:\\tools'
      ];

      for (const baseDir of searchDirs) {
        if (!fs.existsSync(baseDir)) continue;

        // Check direct gmsh.exe
        candidates.push(path.join(baseDir, 'gmsh.exe'));
        candidates.push(path.join(baseDir, 'gmsh', 'gmsh.exe'));

        // Scan for versioned directories like 'gmsh-4.15.2-Windows64'
        try {
          const entries = fs.readdirSync(baseDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && entry.name.toLowerCase().startsWith('gmsh')) {
              candidates.push(path.join(baseDir, entry.name, 'gmsh.exe'));
              candidates.push(path.join(baseDir, entry.name, 'bin', 'gmsh.exe'));
            }
          }
        } catch {
          // Ignore permission denied or access errors
        }
      }

      // Conda / Python / Scoop paths
      if (userProfile) {
        candidates.push(path.join(userProfile, 'anaconda3', 'Scripts', 'gmsh.exe'));
        candidates.push(path.join(userProfile, 'miniconda3', 'Scripts', 'gmsh.exe'));
        candidates.push(path.join(userProfile, 'anaconda3', 'Library', 'bin', 'gmsh.exe'));
        candidates.push(path.join(userProfile, 'miniconda3', 'Library', 'bin', 'gmsh.exe'));
        candidates.push(path.join(userProfile, 'scoop', 'shims', 'gmsh.exe'));
      }
    } else if (isMac) {
      candidates.push('/Applications/Gmsh.app/Contents/MacOS/gmsh');
      const home = os.homedir();
      candidates.push(path.join(home, 'Applications', 'Gmsh.app', 'Contents', 'MacOS', 'gmsh'));
      candidates.push('/usr/local/bin/gmsh');
      candidates.push('/opt/homebrew/bin/gmsh');
      candidates.push(path.join(home, '.local', 'bin', 'gmsh'));
    } else {
      // Linux
      candidates.push('/usr/bin/gmsh');
      candidates.push('/usr/local/bin/gmsh');
      candidates.push('/opt/gmsh/bin/gmsh');
      candidates.push(path.join(os.homedir(), '.local', 'bin', 'gmsh'));
    }

    return Array.from(new Set(candidates));
  }

  /**
   * Run candidate executable with -info to ensure it is a valid Gmsh binary and extract version.
   */
  public static async verifyGmshExecutable(execPath: string): Promise<GmshDetectResult> {
    return new Promise((resolve) => {
      if (!fs.existsSync(execPath)) {
        resolve({ found: false, path: execPath });
        return;
      }

      try {
        const proc = cp.spawn(execPath, ['-info'], {
          windowsHide: true,
          timeout: 4000
        });

        let stdout = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });

        proc.on('close', (code) => {
          if (code === 0 && (stdout.includes('Gmsh') || stdout.includes('Version'))) {
            const versionMatch = stdout.match(/Version\s*:\s*([^\r\n]+)/i);
            const version = versionMatch ? versionMatch[1].trim() : 'Gmsh';
            resolve({
              found: true,
              path: execPath,
              version
            });
          } else {
            resolve({ found: false, path: execPath });
          }
        });

        proc.on('error', () => {
          resolve({ found: false, path: execPath });
        });
      } catch {
        resolve({ found: false, path: execPath });
      }
    });
  }
}
