// TODO: fix 11ty debug helper
const Eleventy = require('@11ty/eleventy/src/Eleventy')
const EleventyErrorHandler = require('@11ty/eleventy/src/EleventyErrorHandler')
const UserConfig = require('@11ty/eleventy/src/UserConfig')
const { resolve } = require('path')
const { toViteSSR } = require('./toViteSSR')
const toEleventyConfig = require('../eleventyConfig')

function toUserConfig(configPath = '') {
  let userConfig
  try {
    userConfig = require(resolve(configPath))
    return userConfig
  } catch {
    /* we'll use defaults if no config file is present */
    return null
  }
}

function toEleventyConfigDir({ configPath = '', input = null, output = null }) {
  const userConfig = toUserConfig(configPath)
  const defaultDir = {
    input: '.',
    output: '_site',
    includes: '_includes',
    layouts: '_includes',
  }

  let userConfigDir = {}
  if (typeof userConfig === 'function') {
    userConfigDir = userConfig?.(new UserConfig())?.dir ?? {}
  } else if (typeof userConfig === 'object') {
    userConfigDir = userConfig?.dir ?? {}
  }

  return {
    ...defaultDir,
    ...userConfigDir,
    input: input ?? userConfigDir.input ?? defaultDir.input,
    output: output ?? userConfigDir.output ?? defaultDir.output,
  }
}

/**
 * @typedef BrowserSyncOptions
 * @property {string} outputDir - dir to serve from
 * @property {number} port - port to serve from
 * @returns {import('browser-sync').Options}
 */
function toBrowserSyncOptions({ outputDir, port }) {
  return {
    server: outputDir,
    port: port,
    // mirror 11ty defaults before we migrate to their Browsersync server
    ignore: ['node_modules'],
    watch: false,
    open: false,
    notify: false,
    ui: false,
    ghostMode: false,
    index: 'index.html',
  }
}

/**
 * @typedef StartEleventyParams
 * @property {import('../@types').Dir} dir
 * @property {import('../@types').UserSlinkityConfig} userSlinkityConfig
 * @property {object} options
 * @param {StartEleventyParams}
 */
async function startEleventy({ dir, userSlinkityConfig, options }) {
  if (process.env.DEBUG) {
    require('time-require')
  }

  const errorHandler = new EleventyErrorHandler()
  process.on('unhandledRejection', (error) => {
    errorHandler.fatal(error, 'Unhandled rejection in promise')
  })
  process.on('uncaughtException', (error) => {
    errorHandler.fatal(error, 'Uncaught exception')
  })
  process.on('rejectionHandled', (promise) => {
    errorHandler.warn(promise, 'A promise rejection was handled asynchronously')
  })

  /** @type {import('../@types').Environment} */
  const environment = options.watch ? 'development' : 'production'
  const config = toEleventyConfig({
    dir,
    environment,
    viteSSR: await toViteSSR({ dir, environment, userSlinkityConfig }),
    userSlinkityConfig,
    browserSyncOptions: toBrowserSyncOptions({ port: options.port, outputDir: dir.output }),
  })

  let elev = new Eleventy(dir.input, dir.output, {
    quietMode: options.quiet,
    configPath: options.config,
    config,
    source: 'cli',
  })

  elev.setPathPrefix(options.pathprefix)
  elev.setDryRun(options.dryrun)
  elev.setIncrementalBuild(options.incremental)
  elev.setPassthroughAll(options.passthroughall)
  elev.setFormats(options.formats)

  await elev.init()
  if (options.watch) {
    await elev.watch()
  } else {
    await elev.write()
  }
}

module.exports = { toEleventyConfigDir, startEleventy }
