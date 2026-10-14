import { err, ok, type Result } from '../../../shared/domain/Result';
import { AuditEvent } from '../../auth/domain/audit-event';
import {
  isSupplyReference,
  Supply,
  type SupplyInput,
  type SupplyInvalid,
} from '../domain/supply';
import type {
  SupplyRecord,
  SupplyRepository,
  SupplyWriteResult,
} from './supply-repository';

export type SupplyMutationError =
  | SupplyInvalid
  | Readonly<{
      code:
        | 'UNAUTHORIZED'
        | 'SUPPLY_NOT_FOUND'
        | 'SUPPLY_CATEGORY_NOT_FOUND'
        | 'SUPPLY_NAME_TAKEN';
    }>;

export type CreateSupplyCommand = Readonly<{
  actorUserId: string | null;
  categoryId: string;
  input: SupplyInput;
}>;

export type UpdateSupplyCommand = Readonly<{
  actorUserId: string | null;
  supplyId: string;
  input: SupplyInput;
}>;

export type ArchiveSupplyCommand = Readonly<{
  actorUserId: string | null;
  supplyId: string;
}>;

type SupplyEvent = 'supply.created' | 'supply.updated' | 'supply.archived';

const unauthorized = err({ code: 'UNAUTHORIZED' } as const);
const notFound = err({ code: 'SUPPLY_NOT_FOUND' } as const);

const isActor = (actorUserId: string | null): actorUserId is string =>
  Boolean(actorUserId?.trim());

/**
 * The audit record has no subject column for a supply id and metadata only
 * allows `reason`/`method`, so supply events trace actor, action and time
 * only. Names, units and costs are never written to the audit log.
 */
const auditEvent = (eventType: SupplyEvent, actorUserId: string) =>
  AuditEvent.create({
    eventType,
    outcome: 'success',
    actorUserId,
    metadata: { method: 'admin_supply_form' },
  });

const toResult = (
  written: SupplyWriteResult,
): Result<SupplyRecord, SupplyMutationError> => {
  if (written.ok) return ok(written.supply);
  if (written.reason === 'name_taken')
    return err({ code: 'SUPPLY_NAME_TAKEN' });
  if (written.reason === 'category_not_found') {
    return err({ code: 'SUPPLY_CATEGORY_NOT_FOUND' });
  }
  return notFound;
};

export const listActiveSupplies = (repository: SupplyRepository) =>
  repository.listActive();

export const listSupplyCategories = (repository: SupplyRepository) =>
  repository.listCategories();

export const getActiveSupply = async (
  repository: SupplyRepository,
  supplyId: string,
): Promise<SupplyRecord | null> =>
  isSupplyReference(supplyId) ? repository.findActive(supplyId) : null;

export const createSupply = async (
  repository: SupplyRepository,
  command: CreateSupplyCommand,
): Promise<Result<SupplyRecord, SupplyMutationError>> => {
  if (!isActor(command.actorUserId)) return unauthorized;

  const supply = Supply.create(command.input);
  if (!supply.ok) return supply;
  if (!isSupplyReference(command.categoryId)) {
    return err({ code: 'SUPPLY_CATEGORY_NOT_FOUND' });
  }

  return toResult(
    await repository.create(
      command.categoryId,
      supply.value,
      auditEvent('supply.created', command.actorUserId),
    ),
  );
};

export const updateSupply = async (
  repository: SupplyRepository,
  command: UpdateSupplyCommand,
): Promise<Result<SupplyRecord, SupplyMutationError>> => {
  if (!isActor(command.actorUserId)) return unauthorized;
  if (!isSupplyReference(command.supplyId)) return notFound;

  const supply = Supply.create(command.input);
  if (!supply.ok) return supply;

  return toResult(
    await repository.update(
      command.supplyId,
      supply.value,
      auditEvent('supply.updated', command.actorUserId),
    ),
  );
};

export const archiveSupply = async (
  repository: SupplyRepository,
  command: ArchiveSupplyCommand,
): Promise<Result<void, SupplyMutationError>> => {
  if (!isActor(command.actorUserId)) return unauthorized;
  if (!isSupplyReference(command.supplyId)) return notFound;

  const archived = await repository.archive(
    command.supplyId,
    auditEvent('supply.archived', command.actorUserId),
  );
  return archived ? ok(undefined) : notFound;
};
