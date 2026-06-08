/**
 * Collapsible accordion block for grouped sidebar content (e.g. Cameras).
 */
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Typography from '@mui/material/Typography';

export default function SidebarSection({
  title,
  count = null,
  defaultExpanded = true,
  children,
}) {
  return (
    <Accordion
      className="sidebar-section"
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      square
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
        <Typography component="h2" variant="subtitle2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {count != null && (
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 'auto', mr: 1 }}>
            {count}
          </Typography>
        )}
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>{children}</AccordionDetails>
    </Accordion>
  );
}
