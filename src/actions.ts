import open from 'open'
import chalk from 'chalk'
import fetch from 'node-fetch'

import {
  exit,
  readFile,
  writeFile,
  geneDashLine,
  printMessages,
  printSuccess,
  getCurrentRegistry,
  getRegistries,
  isLowerCaseEqual,
  isRegistryNotFound,
  isInternalRegistry,
  RegistryItem,
} from './helpers'

import {
  NRMRC,
  NPMRC,
  AUTH,
  EMAIL,
  ALWAYS_AUTH,
  REPOSITORY,
  REGISTRY,
  HOME,
} from './constants'

async function onList() {
  const currentRegistry = await getCurrentRegistry()
  const registries = await getRegistries()
  const keys = Object.keys(registries)
  const length = Math.max(...keys.map((key) => key.length)) + 3

  const messages = keys.map((key) => {
    const registry = registries[key] as RegistryItem
    const prefix = isLowerCaseEqual(registry[REGISTRY], currentRegistry)
      ? chalk.green.bold('* ')
      : '  '
    return prefix + key + geneDashLine(key, length) + registry[REGISTRY]
  })

  printMessages(messages)
}

async function onCurrent(params?: { showUrl?: boolean }) {
  const { showUrl } = params || {}
  const currentRegistry = await getCurrentRegistry()
  let usingUnknownRegistry = true
  const registries = await getRegistries()
  for (const name in registries) {
    const registry = registries[name] as RegistryItem
    if (isLowerCaseEqual(registry[REGISTRY], currentRegistry)) {
      usingUnknownRegistry = false
      printMessages([
        `You are using ${chalk.green(
          showUrl ? registry[REGISTRY] : name
        )} registry.`,
      ])
    }
  }
  if (usingUnknownRegistry) {
    printMessages([
      `Your current registry(${currentRegistry}) is not included in the nrm registries.`,
      `Use the ${chalk.green(
        'nrm add <registry> <url> [home]'
      )} command to add your registry.`,
    ])
  }
}

async function onUse(name: string) {
  if (await isRegistryNotFound(name)) {
    return
  }

  const registries = await getRegistries()
  const registry = registries[name]
  const npmrc = await readFile(NPMRC)
  await writeFile(NPMRC, Object.assign(npmrc, registry))

  printSuccess(`The registry has been changed to '${name}'.`)
}

async function onDelete(name: string) {
  if (
    (await isRegistryNotFound(name)) ||
    (await isInternalRegistry(name, 'delete'))
  ) {
    return
  }

  const customRegistries = await readFile(NRMRC)
  const registry = customRegistries[name]
  delete customRegistries[name]
  await writeFile(NRMRC, customRegistries)
  printSuccess(`The registry '${name}' has been deleted successfully.`)

  const currentRegistry = await getCurrentRegistry()
  if (currentRegistry === registry[REGISTRY]) {
    await onUse('npm')
  }
}

async function onAdd(name: string, url: string, home: string) {
  const registries = await getRegistries()
  const registryNames = Object.keys(registries)
  const registryUrls = registryNames.map(
    (name) => (registries[name] as RegistryItem)[REGISTRY]
  )
  if (
    registryNames.includes(name) ||
    registryUrls.some((eachUrl) => isLowerCaseEqual(eachUrl, url))
  ) {
    return exit(
      'The registry name or url is already included in the nrm registries. Please make sure that the name and url are unique.'
    )
  }
  // custom registry
  const newRegistry: RegistryItem = { home: '', [REGISTRY]: '' }
  newRegistry[REGISTRY] = /\/$/.test(url) ? url : url + '/'
  if (home) {
    newRegistry[HOME] = home
  }
  const customRegistries = await readFile(NRMRC)
  const newCustomRegistries = Object.assign(customRegistries, {
    [name]: newRegistry,
  })
  await writeFile(NRMRC, newCustomRegistries)
  printSuccess(
    `Add registry ${name} success, run ${chalk.green(
      'nrm use ' + name
    )} command to use ${name} registry.`
  )
}

async function onLogin(
  name: string,
  base64: string,
  others: {
    alwaysAuth: boolean
    username: string
    password: string
    email: string
  }
) {
  const { alwaysAuth, username, password, email } = others || {}
  if (
    (await isRegistryNotFound(name)) ||
    (await isInternalRegistry(name, 'set authorization information of'))
  ) {
    return
  }

  const customRegistries = await readFile(NRMRC)
  const registry = customRegistries[name]
  if (base64) {
    registry[AUTH] = base64
  } else if (username && password) {
    registry[AUTH] = Buffer.from(`${username}:${password}`).toString('base64')
  } else {
    return exit(
      'Authorization information in base64 format or username & password is required'
    )
  }

  if (alwaysAuth) {
    registry[ALWAYS_AUTH] = true
  }

  if (email) {
    registry[EMAIL] = email
  }

  Object.assign(customRegistries, { [name]: registry })
  await writeFile(NRMRC, customRegistries)
  printSuccess(
    `Set the authorization information of the registry '${name}' success.`
  )

  const currentRegistry = await getCurrentRegistry()
  if (currentRegistry === registry[REGISTRY]) {
    const npmrc = await readFile(NPMRC)
    await writeFile(
      NPMRC,
      Object.assign(npmrc, {
        [AUTH]: registry[AUTH],
        [ALWAYS_AUTH]: registry[ALWAYS_AUTH],
        [EMAIL]: registry[EMAIL],
      })
    )
  }
}

async function onSetRepository(name: string, repo: string) {
  if (
    (await isRegistryNotFound(name)) ||
    (await isInternalRegistry(name, 'set repository of'))
  ) {
    return
  }

  const customRegistries = await readFile(NRMRC)
  const registry = customRegistries[name]
  registry[REPOSITORY] = repo
  await writeFile(NRMRC, customRegistries)
  printSuccess(`Set the ${REPOSITORY} of registry '${name}' successfully.`)

  const currentRegistry = await getCurrentRegistry()
  if (currentRegistry && registry[REGISTRY] === currentRegistry) {
    const npmrc = await readFile(NPMRC)
    Object.assign(npmrc, { [REPOSITORY]: repo })
    await writeFile(NPMRC, npmrc)
    printSuccess(`Set repository attribute of npmrc successfully`)
  }
}

async function onSetScope(scopeName: string, url: string) {
  const scopeRegistryKey = `${scopeName}:${REGISTRY}`
  const npmrc = await readFile(NPMRC)
  Object.assign(npmrc, { [scopeRegistryKey]: url })
  await writeFile(NPMRC, npmrc)
  printSuccess(`Set scope '${scopeRegistryKey}=${url}' success.`)
}

async function onDeleteScope(scopeName: string) {
  const scopeRegistryKey = `${scopeName}:${REGISTRY}`
  const npmrc = await readFile(NPMRC)
  if (npmrc[scopeRegistryKey]) {
    delete npmrc[scopeRegistryKey]
    await writeFile(NPMRC, npmrc)
    printSuccess(`Delete scope '${scopeRegistryKey}' success.`)
  }
}

async function onSetAttribute(
  name: string,
  attrItem: { attr: string; value: string }
) {
  const { attr, value } = attrItem
  if (
    (await isRegistryNotFound(name)) ||
    (await isInternalRegistry(name, 'set attribute of'))
  ) {
    return
  }

  if (REPOSITORY === attr) {
    return exit(
      `Use the ${chalk.green(
        'nrm set-hosted-repo <name> <repo>'
      )} command to set repository.`
    )
  }
  const customRegistries = await readFile(NRMRC)
  const registry = customRegistries[name]
  Object.assign(registry, { [attr]: value })
  await writeFile(NRMRC, customRegistries)
  printSuccess(
    `Set attribute '${attr}=${value}' of the registry '${name}' successfully.`
  )

  const currentRegistry = await getCurrentRegistry()
  if (currentRegistry === registry[REGISTRY]) {
    const npmrc = await readFile(NPMRC)
    await writeFile(NPMRC, Object.assign(npmrc, { [attr]: value }))
  }
}

async function onRename(name: string, newName: string) {
  if (
    (await isRegistryNotFound(name)) ||
    (await isInternalRegistry(name, 'rename'))
  ) {
    return
  }
  if (name === newName) {
    return exit('The names cannot be the same.')
  }

  if (!(await isRegistryNotFound(newName, false))) {
    return exit(`The new registry name '${newName}' is already exist.`)
  }
  const customRegistries = await readFile(NRMRC)
  customRegistries[newName] = JSON.parse(JSON.stringify(customRegistries[name]))
  delete customRegistries[name]
  await writeFile(NRMRC, customRegistries)
  printSuccess(`The registry '${name}' has been renamed to '${newName}'.`)
}

async function onHome(name: string, browser: string) {
  if (await isRegistryNotFound(name)) {
    return
  }

  const registries = await getRegistries()
  const registry = registries[name] as RegistryItem
  if (!registry[HOME]) {
    return exit(`The homepage of registry '${name}' is not found.`)
  }
  open(registry[HOME], browser ? { app: { name: browser } } : undefined)
}

async function onTest(target: string) {
  const registries = await getRegistries()
  const timeout = 5000

  if (target && (await isRegistryNotFound(target))) {
    exit(`${target}'s registry not found`)
    return
  }

  const sources = target ? { [target]: registries[target] } : registries

  const results = await Promise.all(
    Object.keys(sources).map(async (name) => {
      const { registry } = sources[name] as any
      const start = Date.now()
      let status = false
      let isTimeout = false
      try {
        const response = await fetch(registry + 'nrm', { timeout })
        status = response.ok
      } catch (error: any) {
        isTimeout = error?.type === 'request-timeout'
      }
      return {
        name,
        registry,
        success: status,
        time: Date.now() - start,
        isTimeout,
      }
    })
  )

  const [fastest] = results
    .filter((each) => each.success)
    .map((each) => each.time)
    .sort((a, b) => a - b)

  const messages: string[] = []
  const currentRegistry = await getCurrentRegistry()
  const errorMsg = chalk.red(
    ' (Fetch error, if this is your private registry, please ignore)'
  )
  const timeoutMsg = chalk.yellow(` (Fetch timeout over ${timeout} ms)`)
  const length = Math.max(...Object.keys(sources).map((key) => key.length)) + 3
  results.forEach(({ registry, success, time, name, isTimeout }) => {
    const isFastest = time === fastest
    const tick = isTimeout ? 'timeout' : `${time} ms`
    const prefix = registry === currentRegistry ? chalk.green('* ') : '  '
    let suffix = isFastest && !target ? chalk.bgGreenBright(time + ' ms') : tick
    if (!success) {
      suffix += isTimeout ? timeoutMsg : errorMsg
    }
    messages.push(
      prefix + name + geneDashLine(name, length) + suffix + ` (${registry})`
    )
  })
  printMessages(messages)
  return
}

export {
  onList,
  onCurrent,
  onUse,
  onAdd,
  onDelete,
  onRename,
  onHome,
  onSetRepository,
  onSetScope,
  onDeleteScope,
  onSetAttribute,
  onTest,
  onLogin,
}
