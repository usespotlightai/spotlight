export const PETSTORE = {
  openapi: '3.0.4',
  info: { title: 'Swagger Petstore - OpenAPI 3.0', version: '1.0.27' },
  servers: [{ url: '/api/v3' }],
  paths: {
    '/pet': {
      put: {
        operationId: 'updatePet',
        summary: 'Update an existing pet.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Pet' },
            },
            'application/xml': { schema: { $ref: '#/components/schemas/Pet' } },
          },
        },
      },
      post: {
        operationId: 'addPet',
        summary: 'Add a new pet to the store.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Pet' },
            },
          },
        },
      },
    },
    '/pet/findByStatus': {
      get: {
        operationId: 'findPetsByStatus',
        summary: 'Finds Pets by status.',
        parameters: [
          {
            name: 'status',
            in: 'query',
            required: false,
            explode: true,
            schema: {
              type: 'string',
              default: 'available',
              enum: ['available', 'pending', 'sold'],
            },
          },
        ],
      },
    },
    '/pet/findByTags': {
      get: {
        operationId: 'findPetsByTags',
        summary: 'Finds Pets by tags.',
        parameters: [
          {
            name: 'tags',
            in: 'query',
            required: false,
            explode: true,
            schema: { type: 'array', items: { type: 'string' } },
          },
        ],
      },
    },
    '/pet/{petId}': {
      parameters: [{ $ref: '#/components/parameters/PetId' }],
      get: { operationId: 'getPetById', summary: 'Find pet by ID.' },
      delete: {
        operationId: 'deletePet',
        summary: 'Deletes a pet.',
        parameters: [
          {
            name: 'api_key',
            in: 'header',
            required: false,
            schema: { type: 'string' },
          },
        ],
      },
    },
    '/pet/{petId}/uploadImage': {
      post: {
        operationId: 'uploadFile',
        summary: 'Uploads an image.',
        requestBody: {
          required: true,
          content: {
            'application/octet-stream': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
      },
    },
    '/store/inventory': {
      get: {
        summary: 'Returns pet inventories by status.',
      },
    },
  },
  components: {
    parameters: {
      PetId: {
        name: 'petId',
        in: 'path',
        description: 'ID of pet',
        required: true,
        schema: { type: 'integer', format: 'int64' },
      },
    },
    schemas: {
      Category: {
        type: 'object',
        properties: {
          id: { type: 'integer', format: 'int64' },
          name: { type: 'string', nullable: true },
          parent: { $ref: '#/components/schemas/Category' },
        },
      },
      Tag: {
        type: 'object',
        properties: {
          id: { type: 'integer', format: 'int64' },
          name: { type: 'string' },
        },
      },
      Pet: {
        required: ['name', 'photoUrls'],
        type: 'object',
        properties: {
          id: { type: 'integer', format: 'int64', example: 10 },
          name: { type: 'string', example: 'doggie' },
          category: { $ref: '#/components/schemas/Category' },
          photoUrls: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
          status: {
            type: 'string',
            description: 'pet status in the store',
            enum: ['available', 'pending', 'sold'],
          },
        },
      },
    },
  },
};
