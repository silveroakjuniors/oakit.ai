import { PoolClient } from 'pg';

export interface FeeAssignmentInput {
  studentId: string;
  schoolId: string;
  feeStructureId: string;
  classId: string;
  client: PoolClient;
}

export interface FeeAssignmentResult {
  fee_accounts_created: number;
}

/**
 * Creates student_fee_accounts for all non-deleted fee heads in a fee structure.
 * Validates that the fee structure belongs to the given classId and schoolId.
 * Uses INSERT ... ON CONFLICT DO NOTHING for idempotency.
 * Returns the count of rows actually inserted.
 * Throws an error if the fee structure does not match the class/school.
 */
export async function assignFeeStructureToStudent(
  input: FeeAssignmentInput
): Promise<FeeAssignmentResult> {
  const { studentId, schoolId, feeStructureId, classId, client } = input;

  // Validate that the fee structure belongs to the given class and school
  const structureResult = await client.query(
    `SELECT id FROM fee_structures WHERE id = $1 AND school_id = $2 AND class_id = $3`,
    [feeStructureId, schoolId, classId]
  );
  if (structureResult.rows.length === 0) {
    throw new Error("Fee structure does not match the student's class");
  }

  // Fetch all non-deleted fee heads for the fee structure
  const headsResult = await client.query(
    `SELECT * FROM fee_heads WHERE fee_structure_id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [feeStructureId, schoolId]
  );

  let totalInserted = 0;

  for (const head of headsResult.rows) {
    const assignedAmount =
      head.rounded_monthly_fee ?? head.calculated_monthly_fee ?? head.amount ?? 0;

    const result = await client.query(
      `INSERT INTO student_fee_accounts
         (student_id, school_id, fee_head_id, assigned_amount, outstanding_balance, status, admission_date)
       VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_DATE)
       ON CONFLICT DO NOTHING`,
      [studentId, schoolId, head.id, assignedAmount, assignedAmount]
    );

    totalInserted += result.rowCount ?? 0;
  }

  return { fee_accounts_created: totalInserted };
}
