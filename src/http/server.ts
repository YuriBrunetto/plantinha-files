import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PrismaClient } from '@prisma/client'
import cors from 'cors'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { env } from './../env'
import { r2 } from './../lib/cloudflare'
import multer from 'multer'
import fs from 'fs'
import path from 'path'

const app = express()
const prisma = new PrismaClient()
const upload = multer({ dest: 'uploads/' })

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
  express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 2 })
)
app.use(cors())

app.get('/', (_, res) => {
  res.send('🤓')
})

app.post('/uploads', upload.single('file'), async (req, res, next) => {
  // return error file not found
  if (!req.file) {
    return res.status(400).send('No files were uploaded.')
  }

  const { file } = req
  const fileKey = randomUUID().concat('-').concat(file.originalname)

  const signedUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: 'plantinha-dev',
      Key: fileKey,
      ContentType: file.mimetype
    }),
    { expiresIn: 600 }
  )

  await prisma.file.create({
    data: {
      name: file.originalname,
      contentType: file.mimetype,
      key: fileKey
    }
  })

  const filePath = path.join(__dirname, '..', '..', 'uploads', file.filename)

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error('Error reading file:', err)
      return
    }

    fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.mimetype
      },
      body: data
    })
      .then(res => {
        // Delete the file after successful upload
        fs.unlink(filePath, err => {
          if (err) {
            console.error('Error deleting file:', err)
          } else {
            console.log('File deleted successfully.')
          }
        })
      })
      .catch(err => {
        console.error(err)
      })
  })

  const directLink = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: 'plantinha-dev',
      Key: fileKey
    }),
    { expiresIn: 600 }
  )

  res.status(200).send({ directLink, fileKey })
})

app.get('/uploads/:key', async (req, res) => {
  const getFileParamsSchema = z.object({
    key: z.string()
  })

  const { key } = getFileParamsSchema.parse(req.params)

  const file = await prisma.file.findFirst({
    where: { key }
  })

  if (!file) {
    res.sendStatus(404).send(`File with key "${key}" not found`)
  }

  const signedUrl = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: 'plantinha-dev',
      Key: file?.key as string
    }),
    { expiresIn: 600 }
  )

  res.status(200).send({ signedUrl })
})

app.listen(env.PORT, () => {
  console.log(`🚀 Server started at http://localhost:${env.PORT}`)
})
