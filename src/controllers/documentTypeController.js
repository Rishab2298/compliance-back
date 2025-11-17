import prisma from '../../prisma/client.js';

// Get all document types for a company
export const getDocumentTypes = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { documentTypes: true },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    res.status(200).json({
      success: true,
      data: company.documentTypes || [],
    });
  } catch (error) {
    console.error('Error fetching document types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch document types',
      error: error.message,
    });
  }
};

// Get a single document type by name
export const getDocumentType = async (req, res) => {
  try {
    const { companyId, name } = req.params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { documentTypes: true },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    const documentType = company.documentTypes.find(dt => dt === name);

    if (!documentType) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found',
      });
    }

    res.status(200).json({
      success: true,
      data: documentType,
    });
  } catch (error) {
    console.error('Error fetching document type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch document type',
      error: error.message,
    });
  }
};

// Create a new document type
export const createDocumentType = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Document type name is required',
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { documentTypes: true },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Check if document type with same name already exists
    if (company.documentTypes.includes(name.trim())) {
      return res.status(409).json({
        success: false,
        message: 'A document type with this name already exists',
      });
    }

    // Add new document type to array
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        documentTypes: {
          push: name.trim(),
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Document type created successfully',
      data: updatedCompany.documentTypes,
    });
  } catch (error) {
    console.error('Error creating document type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create document type',
      error: error.message,
    });
  }
};

// Update a document type (rename)
export const updateDocumentType = async (req, res) => {
  try {
    const { companyId, oldName } = req.params;
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'New document type name is required',
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { documentTypes: true },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Check if old name exists
    if (!company.documentTypes.includes(oldName)) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found',
      });
    }

    // Check if new name already exists
    if (company.documentTypes.includes(newName.trim()) && newName.trim() !== oldName) {
      return res.status(409).json({
        success: false,
        message: 'A document type with this name already exists',
      });
    }

    // Update the array
    const updatedTypes = company.documentTypes.map(type =>
      type === oldName ? newName.trim() : type
    );

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        documentTypes: updatedTypes,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Document type updated successfully',
      data: updatedCompany.documentTypes,
    });
  } catch (error) {
    console.error('Error updating document type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update document type',
      error: error.message,
    });
  }
};

// Delete a document type
export const deleteDocumentType = async (req, res) => {
  try {
    const { companyId, name } = req.params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { documentTypes: true },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Check if document type exists
    if (!company.documentTypes.includes(name)) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found',
      });
    }

    // Remove the document type from array
    const updatedTypes = company.documentTypes.filter(type => type !== name);

    await prisma.company.update({
      where: { id: companyId },
      data: {
        documentTypes: updatedTypes,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Document type deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting document type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document type',
      error: error.message,
    });
  }
};
