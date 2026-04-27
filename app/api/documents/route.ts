import { getSession } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb/connect';
import { Doc } from '@/models/Document';
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { createClient } from '@supabase/supabase-js';
import { UserSettings } from '@/models/UserSettings';

// Helper function to serialize MongoDB documents
function serializeDocument(doc: any) {
  return {
    _id: doc._id?.toString() || doc._id,
    projectId: doc.projectId?.toString() || doc.projectId,
    userId: doc.userId?.toString() || doc.userId,
    fileName: doc.fileName,
    fileType: doc.fileType,
    createdAt: doc.createdAt,
    __v: doc.__v,
  };
}

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json(
                { error: 'projectId is required' },
                { status: 400 }
            );
        }

        await connectToDatabase();

        const documents = await Doc.find({ projectId })
            .sort({ createdAt: -1 })
            .lean();

        const serializedDocuments = documents.map(serializeDocument);

        return NextResponse.json({ documents: serializedDocuments });
    } catch (error) {
        console.error('Error fetching documents:', error);
        return NextResponse.json(
            { error: 'Failed to fetch documents' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { projectId, documentId } = body;

        if (!projectId || !documentId) {
            return NextResponse.json(
                { error: 'projectId and documentId are required' },
                { status: 400 }
            );
        }

        await connectToDatabase();

        // Verify document ownership
        const document = await Doc.findOne({
            _id: new mongoose.Types.ObjectId(documentId),
            projectId: new mongoose.Types.ObjectId(projectId),
            userId: new mongoose.Types.ObjectId(String(session.id)),
        });

        if (!document) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Get Supabase credentials from settings
        const settings = await UserSettings.findOne({
            userId: new mongoose.Types.ObjectId(String(session.id)),
        }).lean();

        if (!settings || !settings.supabaseUrl || !settings.supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Missing Supabase credentials' },
                { status: 400 }
            );
        }

        // Delete chunks from Supabase
        const supabase = createClient(
            settings.supabaseUrl,
            settings.supabaseServiceKey
        );

        const { error: supabaseError } = await supabase
            .from('document_chunks')
            .delete()
            .eq('document_id', documentId);

        if (supabaseError) {
            console.error('Supabase deletion error:', supabaseError);
            return NextResponse.json(
                { error: 'Failed to delete document chunks' },
                { status: 500 }
            );
        }

        // Delete document from MongoDB
        await Doc.deleteOne({
            _id: new mongoose.Types.ObjectId(documentId),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting document:', error);
        return NextResponse.json(
            { error: 'Failed to delete document' },
            { status: 500 }
        );
    }
}

