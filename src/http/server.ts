import fastify from 'fastify'
import { PrismaClient } from '@prisma/client'

const app = fastify()
const prisma = new PrismaClient()

app.get('/', () => {
  return 'Hello World'
})

app.get('/files', async () => {
  const files = await prisma.file.findMany()
  return files
})

app.post('/files', async (request: any) => {
  const file = await prisma.file.create({
    data: {
      name: request.body.name
      // url: request.body.url
    }
  })
  return file
})

app.listen({ port: 3333 }).then(() => {
  console.log('🔥 HTTP server is running')
})
