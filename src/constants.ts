import path from 'path'

import REGISTRIES from './registries.json'

const HOME = 'home'
const AUTH = '_auth'
const EMAIL = 'email'
const REGISTRY = 'registry'
const REPOSITORY = 'repository'
const ALWAYS_AUTH = 'always-auth'
const REGISTRY_ATTRS = [REGISTRY, HOME, AUTH, ALWAYS_AUTH]
const NRMRC = path.join(
  process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'] as string,
  '.dxnrmrc'
)
const NPMRC = path.join(
  process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'] as string,
  '.npmrc'
)

export {
  NRMRC,
  NPMRC,
  REGISTRIES,
  AUTH,
  ALWAYS_AUTH,
  REPOSITORY,
  REGISTRY,
  HOME,
  EMAIL,
  REGISTRY_ATTRS,
}
