const jsf = require('json-schema-faker')
const { Model } = require('objection')
const {
  BelongsToOneRelation,
  ManyToManyRelation
} = Model
const toCamelCase = require('lodash.camelcase')

const dirtyModels = []

async function clean() {
  for(let i = 0; i < dirtyModels.length; i++) {
    const model = dirtyModels[i]
    const knex = model.knex()
    const host = knex.client.config.connection.host
    if(host === 'psql') {
      await knex.raw(`TRUNCATE ${model.tableName} CASCADE;`)
    }
    else if(host === 'mysql') {
      await knex.raw('SET FOREIGN_KEY_CHECKS = 0;');
      await knex.raw(`TRUNCATE ${model.tableName};`);
      await knex.raw('SET FOREIGN_KEY_CHECKS = 1;');
    }
    else {
      throw Error('Unhandled host')
    }
  }
}

function addDirtyModel(model) {
  if(dirtyModels.indexOf(model) === -1) {
    dirtyModels.push(model)
  }
}

function getKey(obj, key) {
  return obj[key] !== undefined? key: toCamelCase(key)
}

async function create (model, overrides = {}, {followRelations = true, quantity = 1} = {}) {
  if(model && !model.jsonSchema) {
    throw new Error(`Please add 'jsonSchema' to the model '${model.name}'.`)
  }

  const relations = model.relationMappings
  const relationMappings = {}
  addDirtyModel(model)

  const manyToManyRelations = []

  if(followRelations && relations) {
    for (let field in relations) {
      const {
        relation,
        modelClass,
        join: {to, from, through},
      } = relations[field]
      const toField = to.split('.')[1]
      const fromField = from.split('.')[1]

      if([BelongsToOneRelation.name].includes(relation.name)) {
        if(overrides[field]) {
          relationMappings[getKey(model.jsonSchema.properties, fromField)] = overrides[field][getKey(overrides[field], toField)]
        }
        else {
          const row = await create(modelClass)
          relationMappings[field] = row
          relationMappings[getKey(model.jsonSchema.properties, fromField)] = row[getKey(row, toField)]
        }
      }
      else if(relation.name === ManyToManyRelation.name) {
        let relatedInstances = overrides[field]
        if(!relatedInstances) continue

        if(relatedInstances && !Array.isArray(relatedInstances) || relatedInstances.length === 0) {
          throw new Error(`Please pass an array of instance for field '${field}'.`)
        }

        manyToManyRelations.push([field, through, relatedInstances, toField, fromField])

      }
    }
  }

  const fakes = jsf.generate(model.jsonSchema)
  const toInsert = {
    ...fakes,
    ...overrides,
    ...relationMappings
  }
  const instance = await model.query().insertAndFetch(toInsert)
  return await linkManyToManyRelations(instance, manyToManyRelations, model)
}

async function linkManyToManyRelations(instance, manyToManyRelations, model) {
  for(let i = 0; i < manyToManyRelations.length; i ++ ) {
    const [ field, through, relatedInstances, toField, fromField ] = manyToManyRelations[i]

    const [throughTable, throughFrom] = through.from.split('.')
    const throughTo = through.to.split('.')[1]

    for(let i = 0; i < relatedInstances.length; i++) {
      const fromValue = instance[getKey(instance, fromField)]
      const toValue = relatedInstances[i][getKey(relatedInstances[i], toField)]
      await model.knex()
        .raw(`
          INSERT INTO ${throughTable} ( ${throughFrom}, ${throughTo} )
          VALUES (${fromValue}, ${toValue});
        `);
    }

    instance[field] = relatedInstances
  }
  return instance
}

function prepare(model, overrides) {
  const fakes = jsf.generate(model.jsonSchema)
  return { ...fakes, ...overrides }
}

module.exports = {
  clean,
  create,
  addDirtyModel,
  prepare,
  jsf
}
