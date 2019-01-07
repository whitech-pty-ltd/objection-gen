const jsf = require('json-schema-faker')
const { Model } = require('objection')
const {
  BelongsToOneRelation,
  HasManyRelation,
  ManyToManyRelation
} = Model

async function create(model, overrides = {}, quantity = 1) {
  const relations = model.relationMappings
  const relationMappings = {}

  if(relations) {
    for (let field in relations) {
      if(overrides[field]) continue
      const {
        relation,
        modelClass,
        join: {to, from, through},
      } = relations[field]
      const toField = to.split('.')[1]
      const fromField = from.split('.')[1]

      if([BelongsToOneRelation, HasManyRelation].includes(relation)) {
        const row = await create(modelClass)
        relationMappings[fromField] = row[toField]
      }

      else if(relation === ManyToManyRelation) {
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

module.exports = {
  create
}
