# plantinha-files 🪴📁

> Back-end service to manage files of [Plantinha 🪴](https://github.com/YuriBrunetto/plantinha) project.

ℹ️ This project is mandatory to run in order to use Plantinha project.

## Installation and Usage 🚀

In order to run this project, you need to create a [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket and set the environment variables. You can find the `.env.example` file in the root of the project.

```bash
$ git clone git@github.com:YuriBrunetto/plantinha-files.git
$ cd plantinha-files/
$ pnpm install
$ pnpm dev
```

## Stack

- Node.js
- Typescript
- Express
- Prisma
- Cloudfare R2 (object store)
