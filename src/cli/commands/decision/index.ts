/**
 * Decision command group
 */
import { Command } from 'commander';
import { listDecisions } from './list.js';
import { showDecision } from './show.js';
import { validateDecisions } from './validate.js';
import { createDecision } from './create.js';

export const decisionCommand = new Command('decision')
  .description('Manage architectural decisions')
  .addCommand(listDecisions)
  .addCommand(showDecision)
  .addCommand(validateDecisions)
  .addCommand(createDecision);
