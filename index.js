const jsf = require('json-schema-faker')
const { Model } = require('objection')
const toCamelCase = require('lodash.camelcase')

const {
  BelongsToOneRelation,
  ManyToManyRelation
} = Model
const dirtyModels = []

async function clean() {
  for(let i = 0; i < dirtyModels.length; i+=1) {
    const model = dirtyModels[i]
    const knex = model.knex()
    const { host } = knex.client.config.connection
    if(host === 'psql') {
      /* eslint-disable-next-line no-await-in-loop */
      await knex.raw(`TRUNCATE ${model.tableName} CASCADE;`)
    }
    else if(host === 'mysql') {
      /* eslint-disable-next-line no-await-in-loop */
      await knex.raw('SET FOREIGN_KEY_CHECKS = 0;');
      /* eslint-disable-next-line no-await-in-loop */
      await knex.raw(`TRUNCATE ${model.tableName};`);
      /* eslint-disable-next-line no-await-in-loop */
      await knex.raw('SET FOREIGN_KEY_CHECKS = 1;');
    }
    else {
      throw Error('Unhandled host')
    }

    dirtyModels.shift()
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

async function linkManyToManyRelations(instance, manyToManyRelations, model) {
  for(let i = 0; i < manyToManyRelations.length; i+=1 ) {
    const [ field, through, relatedInstances, toField, fromField ] = manyToManyRelations[i]

    const [throughTable, throughFrom] = through.from.split('.')
    const throughTo = through.to.split('.')[1]

    for(let index = 0; index < relatedInstances.length; index+=1) {
      const fromValue = instance[getKey(instance, fromField)]
      const toValue = relatedInstances[index][getKey(relatedInstances[index], toField)]
      /* eslint-disable-next-line no-await-in-loop */
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

async function create (model, overrides = {}, {followRelations = true} = {}) {
  if(model && !model.jsonSchema) {
    throw new Error(`Please add 'jsonSchema' to the model '${model.name}'.`)
  }

  const relations = model.relationMappings
  const relationMappings = {}
  addDirtyModel(model)

  const manyToManyRelations = []

  if(followRelations && relations) {
    const fields = Object.keys(relations)
    for (let a=0;a<fields.length;a+=1) {
      const field = fields[a]
      const {
        relation,
        modelClass,
        join: {to, from, through},
      } = relations[field]
      const toField = to.split('.')[1]
      const fromField = from.split('.')[1]


      if(BelongsToOneRelation.name === relation.name) {
        if(overrides[field]) {
          relationMappings[getKey(model.jsonSchema.properties, fromField)] = overrides[field][getKey(overrides[field], toField)]
        }
        else {
          const fromFieldValue = overrides[getKey(model.jsonSchema.properties, fromField)]
          if(!fromFieldValue) {
            /* eslint-disable-next-line no-await-in-loop */
            const row = await create(modelClass)
            relationMappings[field] = row
            relationMappings[getKey(model.jsonSchema.properties, fromField)] = row[getKey(row, toField)]
          }
        }
      }
      else if(relation.name === ManyToManyRelation.name) {
        const relatedInstances = overrides[field]
        /* eslint-disable-next-line no-continue */
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
  return linkManyToManyRelations(instance, manyToManyRelations, model)
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
