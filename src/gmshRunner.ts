import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GmshResult } from './types';
import { parseMsh } from './mshParser';
import { parseGeoFallback } from './geoParserFallback';

export class GmshRunner {
  private currentProcess: cp.ChildProcess | null = null;
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'vscode-gmsh-preview');
    if (!fs.existsSync(this.tempDir)) {
      try {
        fs.mkdirSync(this.tempDir, { recursive: true });
      } catch (e) {
        console.error('Failed to create temp directory for gmsh:', e);
      }
    }
  }

  /**
   * Check if gmsh executable is available.
   */
  public async checkGmsh(executablePath: string = 'gmsh'): Promise<{ available: boolean; path: string; version?: string }> {
    return new Promise((resolve) => {
      const candidates = [
        executablePath,
        'gmsh',
        'gmsh.exe',
        'C:\\gmsh\\gmsh.exe',
        'C:\\Program Files\\gmsh\\gmsh.exe',
        'C:\\Program Files (x86)\\gmsh\\gmsh.exe'
      ];

      // Remove duplicates
      const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)));

      const tryNext = (index: number) => {
        if (index >= uniqueCandidates.length) {
          resolve({ available: false, path: executablePath });
          return;
        }

        const candidate = uniqueCandidates[index];
        cp.exec(`"${candidate}" -version`, { timeout: 3000 }, (error, stdout) => {
          if (!error && stdout) {
            const version = stdout.trim();
            resolve({ available: true, path: candidate, version });
          } else {
            tryNext(index + 1);
          }
        });
      };

      tryNext(0);
    });
  }

  /**
   * Run Gmsh to generate mesh and return parsed MeshData.
   */
  public async runGmsh(
    geoContent: string,
    originalFilePath: string,
    executablePath: string = 'gmsh',
    meshDimension: number = 2
  ): Promise<GmshResult> {
    const startTime = Date.now();

    // Kill any existing running process
    if (this.currentProcess) {
      try {
        this.currentProcess.kill();
      } catch {
        // ignore
      }
      this.currentProcess = null;
    }

    const uniqueId = `gmsh_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const tempGeoPath = path.join(this.tempDir, `${uniqueId}.geo`);
    const tempMshPath = path.join(this.tempDir, `${uniqueId}.msh`);

    try {
      // If the original file has includes, resolving relative paths requires running in the original file's directory
      const workingDir = originalFilePath ? path.dirname(originalFilePath) : this.tempDir;

      await fs.promises.writeFile(tempGeoPath, geoContent, 'utf-8');

      // Command arguments
      // e.g.: gmsh temp.geo -format msh -o temp.msh -2
      const args: string[] = [
        tempGeoPath,
        '-format', 'msh',
        '-o', tempMshPath
      ];

      if (meshDimension >= 0 && meshDimension <= 3) {
        args.push(`-${meshDimension}`);
      }

      const gmshExec = executablePath || 'gmsh';

      const runPromise = new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
        const proc = cp.spawn(gmshExec, args, {
          cwd: workingDir,
          windowsHide: true
        });

        this.currentProcess = proc;
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        proc.on('close', (code) => {
          this.currentProcess = null;
          resolve({ code, stdout, stderr });
        });

        proc.on('error', (err) => {
          this.currentProcess = null;
          reject(err);
        });
      });

      let execResult;
      try {
        execResult = await runPromise;
      } catch (execErr: any) {
        // Gmsh not found or could not be executed - Fallback to JS parser
        const fallbackData = parseGeoFallback(geoContent);
        return {
          success: false,
          data: fallbackData,
          error: `Gmsh executable not found or failed to launch (${execErr?.message || 'ENOENT'}). Using fallback preview. Please configure 'gmsh.executablePath'.`,
          durationMs: Date.now() - startTime
        };
      }

      const allOutput = `${execResult.stdout}\n${execResult.stderr}`;

      // Check for Gmsh errors in output (e.g., Error : '...', line 12: ...)
      const errorMatch = allOutput.match(/Error\s*:\s*(?:'[^']+',\s*)?line\s*(\d+)\s*:\s*([^\r\n]+)/i);
      const generalErrorMatch = allOutput.match(/Error\s*:\s*([^\r\n]+)/i);

      let parsedError: string | undefined;
      let errorLine: number | undefined;

      if (errorMatch) {
        errorLine = parseInt(errorMatch[1], 10);
        parsedError = `Line ${errorLine}: ${errorMatch[2].trim()}`;
      } else if (generalErrorMatch) {
        parsedError = generalErrorMatch[1].trim();
      }

      if (fs.existsSync(tempMshPath)) {
        const mshContent = await fs.promises.readFile(tempMshPath, 'utf-8');
        const meshData = parseMsh(mshContent);

        // Cleanup
        this.cleanupFile(tempGeoPath);
        this.cleanupFile(tempMshPath);

        return {
          success: !parsedError,
          data: meshData,
          error: parsedError,
          errorLine,
          rawOutput: allOutput,
          durationMs: Date.now() - startTime
        };
      } else {
        // Output MSH was not generated, likely due to syntax error
        const fallbackData = parseGeoFallback(geoContent);
        this.cleanupFile(tempGeoPath);

        return {
          success: false,
          data: fallbackData,
          error: parsedError || 'Gmsh failed to generate mesh. Showing fallback preview.',
          errorLine,
          rawOutput: allOutput,
          durationMs: Date.now() - startTime
        };
      }
    } catch (err: any) {
      const fallbackData = parseGeoFallback(geoContent);
      return {
        success: false,
        data: fallbackData,
        error: `Unexpected error: ${err?.message || err}`,
        durationMs: Date.now() - startTime
      };
    }
  }

  /**
   * Export to file format (STL, OBJ, or MSH).
   */
  public async exportFile(
    geoContent: string,
    originalFilePath: string,
    outputPath: string,
    format: 'stl' | 'obj' | 'msh',
    executablePath: string = 'gmsh',
    meshDimension: number = 2
  ): Promise<{ success: boolean; error?: string }> {
    const tempGeoPath = path.join(this.tempDir, `export_${Date.now()}.geo`);
    const workingDir = originalFilePath ? path.dirname(originalFilePath) : this.tempDir;

    try {
      await fs.promises.writeFile(tempGeoPath, geoContent, 'utf-8');

      const args: string[] = [
        tempGeoPath,
        '-format', format,
        '-o', outputPath
      ];

      if (meshDimension >= 0 && meshDimension <= 3) {
        args.push(`-${meshDimension}`);
      }

      return new Promise((resolve) => {
        cp.execFile(executablePath || 'gmsh', args, { cwd: workingDir }, (err, stdout, stderr) => {
          this.cleanupFile(tempGeoPath);
          if (err || !fs.existsSync(outputPath)) {
            resolve({
              success: false,
              error: stderr || stdout || err?.message || 'Export failed'
            });
          } else {
            resolve({ success: true });
          }
        });
      });
    } catch (err: any) {
      return { success: false, error: err?.message || 'Export failed' };
    }
  }

  private cleanupFile(filePath: string) {
    fs.unlink(filePath, () => {});
  }
}
