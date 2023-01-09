import fs from 'fs'
import ini from 'ini'
import chalk from 'chalk'

import { NRMRC, NPMRC, REGISTRY, REGISTRIES } from './constants'

export interface RegistryItem {
  home: string
  registry: string
}

export interface Registries {
  [name: string]: RegistryItem
}

async function readFile<T = any>(
  file: string
): Promise<T | Record<string, unknown>> {
  return new Promise((resolve) => {
    if (!fs.existsSync(file)) {
      resolve({})
    } else {
      try {
        const content = ini.parse(fs.readFileSync(file, 'utf-8'))
        resolve(content)
      } catch (error: any) {
        exit(error)
      }
    }
  })
}

async function writeFile(path: string, content: string) {
  return new Promise((resolve) => {
    try {
      fs.writeFileSync(path, ini.stringify(content))
      resolve(null)
    } catch (error: any) {
      exit(error)
    }
  })
}

function padding(message = '', before = 1, after = 1) {
  return (
    new Array(before).fill(' ').join('') +
    message +
    new Array(after).fill(' ').join('')
  )
}

function printSuccess(message: string) {
  console.log(chalk.bgGreenBright(padding('SUCCESS')) + ' ' + message)
}

function printError(error: string) {
  console.error(chalk.bgRed(padding('ERROR')) + ' ' + chalk.red(error))
}

function printMessages(messages: string[]) {
  for (const message of messages) {
    console.log(message)
  }
}

function geneDashLine(message: string, length: number) {
  const finalMessage = new Array(Math.max(2, length - message.length + 2)).join(
    '-'
  )
  return padding(chalk.dim(finalMessage))
}

function isLowerCaseEqual(str1: string, str2: string) {
  if (str1 && str2) {
    return str1.toLowerCase() === str2.toLowerCase()
  } else {
    return !str1 && !str2
  }
}

async function getCurrentRegistry() {
  const npmrc = await readFile(NPMRC)
  return npmrc[REGISTRY]
}

async function getRegistries() {
  const customRegistries = await readFile<Registries>(NRMRC)
  return Object.assign({}, REGISTRIES, customRegistries)
}

async function isRegistryNotFound(name: string, printErr = true) {
  const registries = await getRegistries()
  if (!Object.keys(registries).includes(name)) {
    printErr && printError(`The registry '${name}' is not found.`)
    return true
  }
  return false
}

async function isInternalRegistry(name: string, handle: string) {
  if (Object.keys(REGISTRIES).includes(name)) {
    handle && printError(`You cannot ${handle} the nrm internal registry.`)
    return true
  }
  return false
}

function exit(error: string) {
  error && printError(error)
  process.exit(1)
}

export {
  exit,
  geneDashLine,
  printError,
  printSuccess,
  printMessages,
  isLowerCaseEqual,
  readFile,
  writeFile,
  getRegistries,
  getCurrentRegistry,
  isRegistryNotFound,
  isInternalRegistry,
}
