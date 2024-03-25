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
import { getTruncatedTime } from '../utils/truncatedTime'
import { env } from './../env'
import { r2 } from './../lib/cloudflare'

const app = express()
const prisma = new PrismaClient()
const upload = multer({ dest: 'uploads/' })

// app.use((req, res, next) => {
//   // Website you wish to allow to connect
//   res.setHeader('Access-Control-Allow-Origin', '127.0.0.1:3000')
//
//   // Request methods you wish to allow
//   res.setHeader(
//     'Access-Control-Allow-Methods',
//     'GET, POST, OPTIONS, PUT, PATCH, DELETE'
//   )
//
//   // Request headers you wish to allow
//   res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type')
//
//   // Set to true if you need the website to include cookies in the requests sent
//   // to the API (e.g. in case you use sessions)
//   res.setHeader('Access-Control-Allow-Credentials', 'true')
//
//   // Pass to next layer of middleware
//   next()
// })
app.use(express.json({ limit: '50mb' }))
app.use(
  express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 2 })
)
app.use(cors())

app.get('/', (_, res) => {
  res.send('🤓')
})

app.post('/uploads', upload.single('file'), async (req, res) => {
  const { file } = req

  if (!file) {
    return res.status(400).send('No files were uploaded.')
  }

  const fileKey = randomUUID().concat('-').concat(file.originalname)

  const signedUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: 'plantinha-dev',
      Key: fileKey,
      ContentType: file.mimetype,
      ACL: 'public-read'
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
      .then(_ => {
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
        res.status(500).send('Internal server error: ' + err)
      })
  })

  res.status(200).json({ fileKey })
})

app.get('/uploads/:key', async (req, res) => {
  const { key } = req.params

  if (!key) {
    res.status(400).send('Bad request: key is required')
  }

  const file = await prisma.file.findFirst({
    where: { key }
  })

  if (!file) {
    res.status(404)
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
