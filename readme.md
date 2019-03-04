## Introduction

`objection-gen` generates random data for a model and other related models.
It uses a model's `jsonSchema` to generate random data. Internally it uses
[json-schema-faker](https://github.com/json-schema-faker/json-schema-faker) for this.

## Installation
Using npm
```
npm install -s objection-gen
```

Using yarn
```
yarn add objection-gen
```

## Supported db
- psql
- mysql

## Walk through

For walk though lets consider following models:
- `Profile` has one to one relation with `Account`
- `Account` has one to many relation with `Blog`

```javascript
import { create, prepare, clean }  from 'objection-gen'

class Account extends Model {
  static get tableName() {
    return 'account'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      properties: {
        id: {type: 'integer', minimum: 1},
        username: {type: 'string'},
        email: {type: 'string'},
        password: {type: 'string'},
        full_name: {type: 'string'}
      },
      required: ['id', 'username', 'email', 'password', 'full_name']
    }
  }
}

class Blog extends Model {
  static get tableName() {
    return 'blog'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      properties: {
        id: {type: 'integer', minimum: 1},
        title: {type: 'string'},
        body: {type: 'string'},
        account_id: {type: 'integer', minimum: 1}
      },
      required: ['id', 'title', 'body', 'account_id']
    }
  }

  static get relationMappings() {
    return {
      account: {
        relation: Model.BelongsToOneRelation,
        modelClass: Account,
        join: {
          from: 'blog.account_id',
          to: 'account.id'
        }
      }
    }
  }
}

// The statement below generates random data for `Blog` as well as `Account` and inserts them to the db.
create(Blog)

clean() // truncates both Blog and Account tables

```

## API
### 1. create(model: ObjectionModel, overrides: object, options: object)
#### 1.1. model
It is an Objection model with `jsonSchema`.

#### 1.2. overrides
It is an object used for overriding generated data.
For example, `create(Account, {username: 'ausername'})` will generate
random data for all columns except for `username`.

#### 1.3. options
Default value of options `{followRelations: true}`
Set `followRelations` to `false` if we do not want to insert related models.


### 2. clean()
It truncates the tables populated using `create` function.
Internally `objection-gen` keeps the list of dirty tables.
One can add new dirty table using `addDirtyModel` function if the table
is being populated through other means. After that `clean` will truncate
those tables too.

### 3. prepare(model: ObjectionModel, overrides: object)
It returns the random data for a model but does not inserts in to the db.
The data returned by it is flat which means it does not follow the relations.

### 4. addDirtyModel(model: ObjectionModel)
It adds a model to `objection-gen`'s internal list of dirty models.
Use it if one wishes to use `clean()` for truncating dirty models that
are being populated manually.

