import React from 'react';
import { Slider, Box, TextField } from '@mui/material';
import { Node } from 'src/types';
import { MarkdownEditor } from 'src/components/MarkdownEditor/MarkdownEditor';
import { DeleteButton } from '../../components/DeleteButton';
import { Section } from '../../components/Section';

interface Props {
  node: Node;
  onUpdate: (updates: Partial<Node>) => void;
  onDelete: () => void;
}

export const NodeSettings = ({ node, onUpdate, onDelete }: Props) => {
  return (
    <>
      <Section title="Label">
        <TextField
          value={node.label}
          onChange={(e) => {
            const text = e.target.value as string;
            if (node.label !== text) onUpdate({ label: text });
          }}
        />
      </Section>
      <Section title="Description">
        <MarkdownEditor
          value={node.description}
          onChange={(text) => {
            if (node.description !== text) onUpdate({ description: text });
          }}
        />
      </Section>
      {node.label && (
        <Section title="Label height">
          <Slider
            marks
            step={20}
            min={60}
            max={280}
            value={node.labelHeight}
            onChange={(e, newHeight) => {
              onUpdate({ labelHeight: newHeight as number });
            }}
          />
        </Section>
      )}
      <Section>
        <Box>
          <DeleteButton onClick={onDelete} />
        </Box>
      </Section>
    </>
  );
};
