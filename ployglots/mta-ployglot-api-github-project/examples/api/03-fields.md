# API Example: client.fields

## Goal

CRUD for the project's custom field schema across all five `dataType`s, with a guard rejecting writes to built-in fields.

## Signature / Contract

```ts
type DataType = 'TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT' | 'ITERATION';
type OptionColor = 'GRAY' | 'BLUE' | 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'PINK' | 'PURPLE';

client.fields = {
  list(projectId: string): AsyncIterable<Field>,
  get(fieldId: string): Promise<Field>,
  create(projectId: string, def: {
    name: string;
    dataType: DataType;
    singleSelectOptions?: Array<{ name: string; color?: OptionColor; description?: string }>;  // SINGLE_SELECT
    iterationConfiguration?: { startDate: string; duration: number };                          // ITERATION
  }): Promise<Field>,
  update(fieldId: string, fields: Partial<{
    name: string;
    singleSelectOptions: Array<{ id?: string; name: string; color?: OptionColor; description?: string }>;
  }>): Promise<Field>,
  delete(fieldId: string): Promise<{ id: string }>,
  BUILT_IN_FIELDS: Set<string>,
}
```

## Field shape

```ts
type Field = {
  id: string;
  name: string;
  dataType: DataType;
  isBuiltIn: boolean;
  options?: Array<{ id, name, color, description }>;        // SINGLE_SELECT
  configuration?: { startDay, duration, iterations, completedIterations }; // ITERATION
  createdAt: string;
  updatedAt: string;
}
```

## Errors / Failure modes

| Condition                                                         | Surface                                  |
| ----------------------------------------------------------------- | ---------------------------------------- |
| `create` missing `name`                                           | `ValidationError`                        |
| `create` invalid `dataType`                                       | `ValidationError`                        |
| `create` SINGLE_SELECT without `singleSelectOptions`              | `ValidationError`                        |
| `create` SINGLE_SELECT with invalid `color`                       | `ValidationError`                        |
| `create` ITERATION without `iterationConfiguration`               | `ValidationError`                        |
| `update` / `delete` on a built-in field (`Title`, `Status`, etc.) | `BuiltInFieldError` (`code: 'BUILT_IN_FIELD'`) |

## Example

```js
const f = await client.fields.create(projectId, {
  name: 'Priority',
  dataType: 'SINGLE_SELECT',
  singleSelectOptions: [
    { name: 'Low',  color: 'GRAY' },
    { name: 'Med',  color: 'YELLOW' },
    { name: 'High', color: 'RED' },
  ],
});

await client.fields.update(f.id, {
  singleSelectOptions: [
    { id: f.options[0].id, name: 'Low' },
    { id: f.options[1].id, name: 'Medium', color: 'YELLOW' },  // renamed
    { id: f.options[2].id, name: 'High',   color: 'RED' },
    { name: 'Critical', color: 'RED' },                         // added
  ],
});

await client.fields.delete(f.id);
```

## Notes

- `update` for `singleSelectOptions` is upsert-style: options absent from the array are removed by GitHub; pass the full desired list.
- The built-in set: `Title`, `Status`, `Assignees`, `Labels`, `Milestone`, `Repository`, `Linked pull requests`, `Reviewers`. Read-everywhere; reject on write.
