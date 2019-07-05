import * as ConfigUtils from '@expo/config';
import { choosePort, prepareUrls } from 'react-dev-utils/WebpackDevServerUtils';
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import chalk from 'chalk';
import createWebpackCompiler from './createWebpackCompiler';
import * as ProjectUtils from './project/ProjectUtils';
import * as ProjectSettings from './ProjectSettings';
import * as Web from './Web';
// @ts-ignore missing types for Doctor until it gets converted to TypeScript
import * as Doctor from './project/Doctor';
import XDLError from './XDLError';
import ip from './ip';

import { User as ExpUser } from './User';

const HOST = '0.0.0.0';
const DEFAULT_PORT = 19006;
const WEBPACK_LOG_TAG = 'expo';

let webpackDevServerInstance: WebpackDevServer | null = null;
let webpackServerPort: number | null = null;

export function getServer(projectRoot: string): WebpackDevServer | null {
  if (webpackDevServerInstance == null) {
    ProjectUtils.logError(projectRoot, WEBPACK_LOG_TAG, 'Webpack is not running.');
  }
  return webpackDevServerInstance;
}

async function choosePortAsync(): Promise<number> {
  try {
    const port = await choosePort(HOST, DEFAULT_PORT);
    if (port == null) {
      throw new Error(`port ${DEFAULT_PORT} not available.`);
    }
    return port;
  } catch (error) {
    throw new XDLError('NO_PORT_FOUND', 'No available port found: ' + error.message);
  }
}

export async function startAsync(
  projectRoot: string,
  { nonInteractive }: { nonInteractive?: boolean },
  verbose: boolean
): Promise<{ url: string | null; server: WebpackDevServer | null } | null> {
  await Doctor.validateWebSupportAsync(projectRoot);

  if (webpackDevServerInstance) {
    ProjectUtils.logError(projectRoot, WEBPACK_LOG_TAG, 'Webpack is already running.');
    return null;
  }

  const useYarn = ConfigUtils.isUsingYarn(projectRoot);

  const { exp } = await ConfigUtils.readConfigJsonAsync(projectRoot);
  const { webName } = ConfigUtils.getNameFromConfig(exp);

  let { dev, https } = await ProjectSettings.readAsync(projectRoot);
  const mode = dev ? 'development' : 'production';

  const config = await Web.invokeWebpackConfigAsync({
    projectRoot,
    pwa: true,
    development: dev,
    production: !dev,
    https,
    info: Web.isInfoEnabled(),
  });

  const port = await choosePortAsync();
  ProjectUtils.logInfo(
    projectRoot,
    WEBPACK_LOG_TAG,
    `Starting Webpack on port ${port} in ${chalk.underline(mode)} mode.`
  );

  const protocol = https ? 'https' : 'http';
  const urls = prepareUrls(protocol, '::', port);

  await new Promise(resolve => {
    // Create a webpack compiler that is configured with custom messages.
    const compiler = createWebpackCompiler({
      projectRoot,
      nonInteractive,
      webpackFactory: webpack,
      appName: webName,
      config,
      urls,
      useYarn,
      onFinished: resolve,
    });
    const devServer = new WebpackDevServer(compiler, config.devServer || {});
    // Launch WebpackDevServer.
    devServer.listen(port, HOST, error => {
      if (error) {
        ProjectUtils.logError(projectRoot, WEBPACK_LOG_TAG, error.message);
      }
    });
    webpackDevServerInstance = devServer;
    webpackServerPort = port;
  });

  await ProjectSettings.setPackagerInfoAsync(projectRoot, {
    webpackServerPort,
  });

  return {
    server: webpackDevServerInstance,
    url: await getUrlAsync(projectRoot),
  };
}

export async function getUrlAsync(projectRoot: string): Promise<string | null> {
  const devServer = getServer(projectRoot);
  if (!devServer) {
    return null;
  }
  const host = ip.address();
  const urlType = await getProtocolAsync(projectRoot);
  return `${urlType}://${host}:${webpackServerPort}`;
}

export async function getProtocolAsync(projectRoot: string): Promise<'http' | 'https'> {
  // TODO: Bacon: Handle when not in expo
  const { https } = await ProjectSettings.readAsync(projectRoot);
  if (https === true) {
    return 'https';
  }
  return 'http';
}

export async function stopAsync(projectRoot: string): Promise<void> {
  if (webpackDevServerInstance) {
    const server = webpackDevServerInstance;
    await new Promise(resolve => server.close(() => resolve()));
    webpackDevServerInstance = null;
    webpackServerPort = null;
    // TODO
    await ProjectSettings.setPackagerInfoAsync(projectRoot, {
      webpackServerPort: null,
    });
  }
}

export async function bundleAsync(
  projectRoot: string,
  packagerOpts: {
    dev: boolean;
    polyfill: boolean;
    pwa: boolean;
  }
): Promise<void> {
  await Doctor.validateWebSupportAsync(projectRoot);
  const mode = packagerOpts.dev ? 'development' : 'production';
  process.env.BABEL_ENV = mode;
  process.env.NODE_ENV = mode;

  let config = await Web.invokeWebpackConfigAsync({
    projectRoot,
    pwa: packagerOpts.pwa,
    polyfill: packagerOpts.polyfill,
    development: packagerOpts.dev,
    production: !packagerOpts.dev,
    info: Web.isInfoEnabled(),
  });
  let compiler = webpack(config);

  try {
    // We generate the stats.json file in the webpack-config
    await new Promise((resolve, reject) =>
      compiler.run(async (error, stats) => {
        // TODO: Bacon: account for CI
        if (error) {
          // TODO: Bacon: Clean up error messages
          return reject(error);
        }
        resolve(stats);
      })
    );
  } catch (error) {
    ProjectUtils.logError(
      projectRoot,
      'expo',
      'There was a problem building your web project. ' + error.message
    );
    throw error;
  }
}

export async function openAsync(projectRoot: string, options = {}, verbose = true): Promise<void> {
  if (!webpackDevServerInstance) {
    await startAsync(projectRoot, options, verbose);
  }
  await Web.openProjectAsync(projectRoot);
}
