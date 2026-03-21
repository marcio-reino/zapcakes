import prisma from '../config/database.js'

export class CompanyController {
  // GET /api/company — retorna dados da empresa do usuário logado
  async get(request, reply) {
    const userId = request.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true,
        street: true, number: true, complement: true,
        neighborhood: true, city: true, state: true,
        zipCode: true, reference: true,
        account: {
          select: {
            id: true, companyName: true, legalName: true,
            document: true, documentType: true,
            logoUrl: true, responsible: true,
          },
        },
      },
    })

    if (!user) {
      return reply.status(404).send({ error: 'Usuário não encontrado' })
    }

    return {
      // Dados do usuário (endereço)
      name: user.name,
      email: user.email,
      phone: user.phone,
      street: user.street,
      number: user.number,
      complement: user.complement,
      neighborhood: user.neighborhood,
      city: user.city,
      state: user.state,
      zipCode: user.zipCode,
      reference: user.reference,
      // Dados da conta/empresa
      companyName: user.account?.companyName || '',
      legalName: user.account?.legalName || '',
      document: user.account?.document || '',
      documentType: user.account?.documentType || '',
      logoUrl: user.account?.logoUrl || '',
      responsible: user.account?.responsible || '',
    }
  }

  // PUT /api/company — atualiza dados da empresa
  async update(request, reply) {
    const userId = request.user.id
    const {
      companyName, legalName, document, documentType,
      logoUrl, responsible,
      phone, street, number, complement,
      neighborhood, city, state, zipCode, reference,
    } = request.body

    // Atualiza campos de endereço no User
    const userData = {}
    if (phone !== undefined) userData.phone = phone
    if (street !== undefined) userData.street = street
    if (number !== undefined) userData.number = number
    if (complement !== undefined) userData.complement = complement
    if (neighborhood !== undefined) userData.neighborhood = neighborhood
    if (city !== undefined) userData.city = city
    if (state !== undefined) userData.state = state
    if (zipCode !== undefined) userData.zipCode = zipCode
    if (reference !== undefined) userData.reference = reference

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({ where: { id: userId }, data: userData })
    }

    // Atualiza campos da empresa na Account
    const accountData = {}
    if (companyName !== undefined) accountData.companyName = companyName
    if (legalName !== undefined) accountData.legalName = legalName
    if (document !== undefined) accountData.document = document
    if (documentType !== undefined) accountData.documentType = documentType || null
    if (logoUrl !== undefined) accountData.logoUrl = logoUrl
    if (responsible !== undefined) accountData.responsible = responsible

    if (Object.keys(accountData).length > 0) {
      await prisma.account.update({
        where: { userId },
        data: accountData,
      })
    }

    return { success: true }
  }
}
