import { Model, QueryBuilder, Page } from 'objection';
import jsf from 'json-schema-faker';

declare module 'objection-gen' {
  class GenQueryBuilder<M extends typeof Model, R = M[]> {
    ArrayQueryBuilderType: GenQueryBuilder<M, M[]>;
    SingleQueryBuilderType: GenQueryBuilder<M, M>;
    NumberQueryBuilderType: GenQueryBuilder<M, number>;
    PageQueryBuilderType: GenQueryBuilder<M, Page<M>>;
  }

  export function clean(): Promise<void>;
  export function create<T extends typeof Model>(model: T, overrides?: object, options?: { followRelations: boolean; }): Promise<GenQueryBuilder<T>>;
  export function addDirtyModel<T extends typeof Model>(model: T): void;
  export function prepare<T extends typeof Model>(model: T, overrides: object): object;
  export class jsf {
    static generate(schema: object, refs: any[]): object;
    static resolve(schema: object, refs: any[], cwd: string): Promise<any>;
    static extend(name: string, cb: (...args: any[]) => any): jsf;
    static define(name: string, cb: (...args: any[]) => any): jsf;
    static reset(name: string): jsf;
    static locate(name: string): any;
  }
}