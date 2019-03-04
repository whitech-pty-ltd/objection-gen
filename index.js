const jsf = require('json-schema-faker')
const { Model } = require('objection')
const {
  HasOneRelation,
  HasManyRelation,
  ManyToManyRelation
} = Model

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

async function create (model, overrides = {}, {followRelations = true, quantity = 1} = {}) {
  const relations = model.relationMappings
  const relationMappings = {}
  addDirtyModel(model)

  if(followRelations && relations) {
    for (let field in relations) {
      const {
        relation,
        modelClass,
        join: {to, from, through},
      } = relations[field]
      const toField = to.split('.')[1]
      const fromField = from.split('.')[1]

      if([HasOneRelation.name, HasManyRelation.name].includes(relation.name)) {
        if(overrides[field]) {
          relationMappings[fromField] = overrides[field][toField]
        }
        else {
          const row = await create(modelClass)
          relationMappings[field] = row
          relationMappings[fromField] = row[toField]
        }
      }
      else if(relation.name === ManyToManyRelation.name) {
        let relatedInstances = overrides[field]

        if(relatedInstances && !Array.isArray(relatedInstances)) {
          throw new Error(`Please pass an array of instance for field '${field}'.`)
        }

        if(!relatedInstances || relatedInstances.length === 0) {
          relatedInstances = [await create(modelClass)]
        }

        const fakes = jsf.generate(model.jsonSchema)
        const toInsert = {
          ...fakes,
          ...overrides
        }
        const thisRow = await model.query().insert(toInsert)

        const [throughTable, throughFrom] = through.from.split('.')
        const throughTo = through.to.split('.')[1]

        for(let i = 0; i < relatedInstances.length; i++) {
          await model.knex()
            .raw(`
              INSERT INTO ${throughTable} ( ${throughFrom}, ${throughTo} )
              VALUES (${thisRow[fromField]}, ${relatedInstances[i][toField]});
            `);
        }

        thisRow[field] = relatedInstances

        return thisRow
      }
    }
  }

  const fakes = jsf.generate(model.jsonSchema)
  const toInsert = {
    ...fakes,
    ...overrides,
    ...relationMappings
  }
  return model.query().insert(toInsert)
}

function prepare(model, overrides) {
  const fakes = jsf.generate(model.jsonSchema)
  return { ...fakes, ...overrides }
}

module.exports = {
  clean,
  create,
  addDirtyModel,
  prepare
}
