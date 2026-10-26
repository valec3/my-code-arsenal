import pc from 'picocolors';

export const log = {
  info(message: string): void {
    console.log(`${pc.cyan('[info]')} ${message}`);
  },
  success(message: string): void {
    console.log(`${pc.green('[ok]')} ${message}`);
  },
  warn(message: string): void {
    console.log(`${pc.yellow('[warn]')} ${message}`);
  },
  error(message: string): void {
    console.error(`${pc.red('[error]')} ${message}`);
  },
  detail(message: string): void {
    console.log(`       ${pc.dim(message)}`);
  },
  detailError(message: string): void {
    console.error(`       ${pc.dim(message)}`);
  },
  title(message: string): void {
    console.log(`\n${pc.bold(message)}`);
  },
  plain(message = ''): void {
    console.log(message);
  },
};
