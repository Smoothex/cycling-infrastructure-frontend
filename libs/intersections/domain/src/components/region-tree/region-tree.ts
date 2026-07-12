import { Component, input, inject, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { TreeSelect } from 'primeng/treeselect';
import { FormsModule } from '@angular/forms';
import { IntersectionsRegionRequestService } from '../../lib/domain/intersections-region-request.service';
import { TreeNode } from '@simra/intersections-common';


@Component({
	selector: 'intersection-region-tree',
	standalone: true,
	imports: [FormsModule, TreeSelect, TranslatePipe],
	templateUrl: './region-tree.html',
})
export class IntersectionRegionTreeComponent {
    private readonly _requestService = inject(IntersectionsRegionRequestService);

    protected regions: TreeNode[] = [];
	protected selectedRegionNode = signal<TreeNode | null>(null);
    private lastValidNode: TreeNode | null = null;

    public requireSelection = input<boolean>();
    public preselectedRegionLTreePath = input<string>();
    public selectedRegionLTreePath = output<string | null>();

    constructor() {
		this.getTree();
	}

	async getTree() {
		const tree = await this._requestService.getRegionTree();
		this.regions = tree;

        const preselected = this.preselectedRegionLTreePath();
        if (preselected) {
            let targetNode = this.findNodeByLTreePath(this.regions, preselected);
            if (!targetNode && this.regions.length > 0) {
                targetNode = this.regions[0];
            }
            if (!targetNode) {
                console.error("No regions available.")
                return;
            }
            this.lastValidNode = targetNode;
            this.selectedRegionNode.set(targetNode);
        }

		this.onRegionChange();
	}

	onRegionChange () {
		const node = this.selectedRegionNode();

        if (!node) {
            if (this.requireSelection()) {
                setTimeout(() => {
                    // Add timeout, to get deselect style and then force the UI to add the seelct style
                    this.selectedRegionNode.set(this.lastValidNode);
                });
                return;
            }
        } else {
            this.lastValidNode = node;
        }

		if (node) {
            this.selectedRegionLTreePath.emit(node.data.ltreePath);
        } else {
            this.selectedRegionLTreePath.emit(null);
        }
	}

    private findNodeByLTreePath(nodes: TreeNode[], lTreePath: string): TreeNode | null {
        for (const node of nodes) {
            if (node.data.ltreePath === lTreePath) return node;
            if (node.children) {
                const found = this.findNodeByLTreePath(node.children, lTreePath);
                if (found) return found;
            }
        }
        return null;
    }
}
