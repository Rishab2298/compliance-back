import pkg from "@prisma/client";
const { PrismaClient } = pkg;

// Singleton pattern for Prisma Client to avoid connection pool issues
let prisma;

const prismaOptions = {
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient(prismaOptions);
} else {
  // In development, use a global variable to preserve the instance across hot reloads
  if (!global.prisma) {
    global.prisma = new PrismaClient(prismaOptions);
  }
  prisma = global.prisma;
}

// Graceful shutdown - disconnect Prisma on process exit
const shutdown = async () => {
  await prisma.$disconnect();
  console.log('🔌 Prisma disconnected');
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', shutdown);

export default prisma;