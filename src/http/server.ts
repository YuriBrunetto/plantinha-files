import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PrismaClient } from '@prisma/client'
import cors from 'cors'
import express from 'express'
import fs from 'fs'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import path from 'path'
import tk from 'timekeeper'
import { z } from 'zod'
import { getTruncatedTime } from '../utils/truncatedTime'
import { env } from './../env'
import { r2 } from './../lib/cloudflare'

const app = express()
const prisma = new PrismaClient()
const upload = multer({ dest: 'uploads/' })

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
    { expiresIn: 900 }
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
            console.log('File created and deleted successfully.')
          }
        })
      })
      .catch(err => {
        console.error(err)
      })
  })

  res.status(200).send({ fileKey })
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
    res.sendStatus(404).send(`File with key "${key}" not found.`)
  }

  tk.withFreeze(getTruncatedTime(), async () => {
    return await getSignedUrl(
      r2,
      new GetObjectCommand({
        Bucket: 'plantinha-dev',
        Key: file?.key as string
      }),
      { expiresIn: 900 }
    )
  })
    .then(signedUrl => {
      res.status(200).send({ signedUrl })
    })
    .catch(err => {
      res.status(500).send('Internal server error: ' + err)
    })
})

app.listen(env.PORT, () => {
  console.log(`🚀 Server started at http://localhost:${env.PORT}`)
})
