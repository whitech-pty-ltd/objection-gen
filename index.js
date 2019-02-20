const jsf = require('json-schema-faker')
const { Model } = require('objection')
const {
  BelongsToOneRelation,
  HasManyRelation,
  ManyToManyRelation
} = Model

function generator() {
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

  async function create (model, overrides = {}, {followRelations = true, quantity = 1} = {}) {
        const relations = model.relationMappings
        const relationMappings = {}
        dirtyModels.push(model)

        if(followRelations && relations) {
          for (let field in relations) {
            if(overrides[field]) continue
            const {
              relation,
              modelClass,
              join: {to, from, through},
            } = relations[field]
            const toField = to.split('.')[1]
            const fromField = from.split('.')[1]

            if([BelongsToOneRelation.name, HasManyRelation.name].includes(relation.name)) {
              const row = await create(modelClass)
              relationMappings[fromField] = row[toField]
            }

            else if(relation.name === ManyToManyRelation.name) {
              const thatRow = await create(modelClass)

              const fakes = jsf.generate(model.jsonSchema)
              const toInsert = {
                ...fakes,
                ...overrides
              }
              const thisRow = await model.query().insert(toInsert)

              const [throughTable, throughFrom] = through.from.split('.')
              const throughTo = through.to.split('.')[1]
              await model.knex()
                .raw(`
                  INSERT INTO ${throughTable} ( ${throughFrom}, ${throughTo} )
                  VALUES (${thisRow[fromField]}, ${thatRow[toField]});
                `);

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

  return {
    clean,
    create
  }
}


module.exports = {
  generator
}
