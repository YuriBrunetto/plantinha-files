import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PrismaClient } from '@prisma/client'
import cors from 'cors'
import express from 'express'
import formidable from 'formidable'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { env } from './../env'
import { r2 } from './../lib/cloudflare'

const app = express()
const prisma = new PrismaClient()

app.use((req, res, next) => {
  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', '127.0.0.1:3000')

  // Request methods you wish to allow
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS, PUT, PATCH, DELETE'
  )

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type')

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  // Pass to next layer of middleware
  next()
})
app.use(express.json({ limit: '50mb' }))
app.use(
  express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 1000000 })
)
app.use(cors())

app.get('/', (_, res) => {
  res.send('🤓')
})

app.post('/uploads', (req, res, next) => {
  const form = formidable({})

  form.parse(req, (err, fields, files) => {
    console.log(files)
    res.json({ fields, files })
  })
  console.log('aaaaa')

  // res.send({ hello: 'world' })

  // const fileKey = randomUUID().concat('-').concat(name)
  //
  // const signedUrl = await getSignedUrl(
  //   r2,
  //   new PutObjectCommand({
  //     Bucket: 'plantinha-dev',
  //     Key: fileKey,
  //     ContentType: contentType
  //   }),
  //   { expiresIn: 600 }
  // )

  // const newFile = await prisma.file.create({
  //   data: {
  //     name,
  //     contentType,
  //     key: fileKey
  //   }
  // })
  //
  // fetch(signedUrl, {
  //   method: 'PUT',
  //   headers: {
  //     'Content-Type': 'image/png'
  //   },
  //   body: file
  // })
  //   .then(res => {
  //     console.log('bundaares===>', res)
  //   })
  //   .catch(err => {
  //     console.error(err)
  //   })
  //
  // res.send({ signedUrl, fileId: newFile.id })
})

app.get('/uploads/:id', async (req, res) => {
  const getFileParamsSchema = z.object({
    id: z.string().cuid()
  })

  const { id } = getFileParamsSchema.parse(req.params)

  const file = await prisma.file.findUniqueOrThrow({
    where: { id }
  })

  const signedUrl = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: 'plantinha-dev',
      Key: file.key as string
    }),
    { expiresIn: 600 }
  )

  res.send({ signedUrl })
})

app.listen(env.PORT, () => {
  console.log(`🚀 Server started at http://localhost:${env.PORT}`)
})
