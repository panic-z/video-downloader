import { execFile } from "node:child_process";
import { promisify } from "node:util";

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
  const { stdout, stderr } = await execFileAsync(command, args);
  return { stdout, stderr };
};

export async function checkBinary(
  name: BinaryCheck["name"],
  run: CommandRunner = defaultCommandRunner
): Promise<BinaryCheck> {
  try {
    await run(name, ["--version"]);
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
