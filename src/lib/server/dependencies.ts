import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildBinaryEnvironment, resolveBinaryPath } from "./binaries";

const COMMAND_MAX_BUFFER_BYTES = 25 * 1024 * 1024;

export type BinaryCheck = {
  name: "yt-dlp" | "ffmpeg";
  available: boolean;
  error?: string;
};

export type CommandRunner = (
  command: string,
  args: string[]
) => Promise<{ stdout: string; stderr: string }>;

const execFileAsync = promisify(execFile);

export const defaultCommandRunner: CommandRunner = async (command, args) => {
  const binaryName = command === "yt-dlp" || command === "ffmpeg" ? command : null;
  const executable = binaryName ? resolveBinaryPath(binaryName) : command;
  const { stdout, stderr } = await execFileAsync(executable, args, {
    env: buildBinaryEnvironment(),
    maxBuffer: COMMAND_MAX_BUFFER_BYTES
  });
  return { stdout, stderr };
};

export async function checkBinary(
  name: BinaryCheck["name"],
  run: CommandRunner = defaultCommandRunner
): Promise<BinaryCheck> {
  const versionArgs = name === "ffmpeg" ? ["-version"] : ["--version"];

  try {
    await run(name, versionArgs);
    return { name, available: true };
  } catch (error) {
    return {
      name,
      available: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function checkDependencies(run: CommandRunner = defaultCommandRunner): Promise<BinaryCheck[]> {
  return Promise.all([checkBinary("yt-dlp", run), checkBinary("ffmpeg", run)]);
}
